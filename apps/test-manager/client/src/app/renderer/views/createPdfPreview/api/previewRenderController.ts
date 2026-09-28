import {
  ensureDisplayModeStyle,
  ensureKatexFontStyle,
  ensureKatexOverrideStyle,
  ensureKatexStyle,
} from '@api/ensurePdf';
import { extractImageIdsFromHtml } from '@api/utils';
import { realizeDomImages } from '@components/templates/preview/imageRealizer';
import { DUMMY_IMG } from '@renderer/api/dummyImage';
import type { DisplayMode } from '@renderer/api/ensurePdf';
import {
  buildReadyAssetUrl,
  readImageDimensionsFromAsset,
} from '@renderer/api/imageAssetCache';
import {
  readCreatePdfPreviewDocument,
  selectSlot,
} from '@renderer/api/pdfPreviewBridge';
import { reportPreviewImageDimensionFallback } from '@renderer/api/previewImageDimensionTelemetry';
import type { AssetKey, AssetReadyNotice } from '@shared/types/assets';
import type {
  CreatePdfExportManifestOptions,
  CreatePdfExportManifestResult,
  CreatePdfExportPreviewWindowStatus,
} from '@shared/types/createPdfExport';
import type {
  CreatePdfPreviewImageRef,
  CreatePdfPreviewSnapshot,
  CreationType,
} from '@shared/types/pdfPreview';
import type { ImageAssetMap } from '@stores/useImageAssetStore';
import { fullRenderPreview } from '@templates/preview/layout/fullRenderPreview';
import { clearViewerDocument } from '@templates/preview/layout/utils';
import { buildLayoutStateFromCreatePdfSnapshot } from '@views/createPdfPreview/api/buildLayoutStateFromCreatePdfSnapshot';
import type { RefObject } from 'react';
import {
  CLOSED_STATUS,
  type CreatePdfPreviewWindowRenderCache,
} from '../types/createPdfType';
import { buildCreatePdfExportManifest } from './createPdfExportManifest';

// main プロセスが executeJavaScript 経由で読む値のチャンネル。
// Zustand ストアではなく、subscribe/notify 機構を持たないシンプルな値ホルダー。
type PreviewWindowBridgePayload = {
  status: CreatePdfExportPreviewWindowStatus;
  getManifest: (
    options?: CreatePdfExportManifestOptions,
  ) => CreatePdfExportManifestResult;
};

type CreatePdfPreviewWindowBridge = {
  getStatus: () => CreatePdfExportPreviewWindowStatus;
  getManifest: (
    options?: CreatePdfExportManifestOptions,
  ) => CreatePdfExportManifestResult;
  setDisplayMode: (mode: DisplayMode) => void; // ← 追加
};

const BRIDGE_KEY = '__CREATE_PDF_PREVIEW_WINDOW__';

type BrowserWindowWithBridge = Window & {
  [BRIDGE_KEY]?: CreatePdfPreviewWindowBridge;
};

const DUMMY_IMAGE_ASSET = (() => {
  const matched = /^data:(.*?);base64,(.+)$/.exec(DUMMY_IMG);
  return {
    contentType: matched?.[1] ?? 'image/png',
    // ダミー画像だけは静的な data URL をそのまま使う（設計14.3の除外）
    url: DUMMY_IMG,
  };
})();

const createPreviewWindowBridgeChannel = () => {
  const payload: PreviewWindowBridgePayload = {
    status: CLOSED_STATUS,
    getManifest: () =>
      toErrorResult('PreviewWindow がまだ初期化されていません。'),
  };
  return {
    getStatus: () => payload.status,
    getManifest: (options?: CreatePdfExportManifestOptions) =>
      payload.getManifest(options),
    setStatus: (next: CreatePdfExportPreviewWindowStatus) => {
      payload.status = next;
    },
    setManifest: (next: CreatePdfExportManifestResult) => {
      payload.getManifest = () => next;
    },
    setManifestBuilder: (
      next: (
        options?: CreatePdfExportManifestOptions,
      ) => CreatePdfExportManifestResult,
    ) => {
      payload.getManifest = next;
    },
  };
};

const collectRequiredImageRefs = (
  snapshot: CreatePdfPreviewSnapshot,
): CreatePdfPreviewImageRef[] => {
  // 旧 snapshot 互換のため、request 対象は items で参照される画像に限定する。
  const requiredKeys = new Set<string>();

  for (const item of snapshot.items) {
    const htmlBlocks = [
      item.questionHtml,
      item.answerHtml,
      ...(item.questionChoicesHtml ?? []),
      ...(item.answerChoicesHtml ?? []),
    ];

    for (const html of htmlBlocks) {
      if (!html) continue;
      for (const key of extractImageIdsFromHtml(html)) {
        requiredKeys.add(key);
      }
    }
  }

  const fallbackGrade = snapshot.grade === 1 ? 'firstGrade' : 'secondGrade';
  const imageRefByKey = new Map(
    snapshot.imageRefs.map((ref) => [ref.key, ref]),
  );

  return Array.from(requiredKeys, (key) => {
    return imageRefByKey.get(key) ?? { grade: fallbackGrade, key };
  });
};

export const toAssetKey = (snapshot: CreatePdfPreviewSnapshot): AssetKey[] =>
  collectRequiredImageRefs(snapshot).map((ref) => ({
    grade: ref.grade,
    key: ref.key,
  }));

export const toAssetCacheKey = (item: {
  grade: AssetKey['grade'];
  key: string;
}) => `${item.grade}/${item.key}`;

export const buildImageAssetMap = async (
  snapshot: CreatePdfPreviewSnapshot,
  readyItems: readonly AssetReadyNotice[],
): Promise<ImageAssetMap> => {
  const requiredImageRefs = collectRequiredImageRefs(snapshot);
  const readyMap = new Map(
    readyItems.map((item) => [toAssetCacheKey(item), item]),
  );
  const missingSizeRefs = requiredImageRefs.filter(
    (ref) => ref.width == null || ref.height == null,
  );

  if (missingSizeRefs.length > 0) {
    console.warn('[createPdfPreviewWindow] image size missing in imageRefs', {
      count: missingSizeRefs.length,
      keys: missingSizeRefs.slice(0, 20).map((ref) => ref.key),
    });
  }

  const entries: Array<[string, ImageAssetMap[string]]> = [];

  for (const ref of requiredImageRefs) {
    const readyItem = readyMap.get(toAssetCacheKey(ref));
    let width = ref.width;
    let height = ref.height;

    if ((!width || !height) && readyItem) {
      const resolvedDims = await readImageDimensionsFromAsset({
        url: buildReadyAssetUrl(ref.grade, ref.key, readyItem),
      });
      if (resolvedDims) {
        width = resolvedDims.width;
        height = resolvedDims.height;
        reportPreviewImageDimensionFallback({
          imageKey: ref.key,
          grade: ref.grade,
          route: 'create-pdf-preview-window',
          fallbackSource: 'base64',
        });
      }
    }

    if (!width || !height) {
      console.warn('[createPdfPreviewWindow] image dimensions unresolved', {
        key: ref.key,
        grade: ref.grade,
        hasReadyAsset: Boolean(readyItem),
      });
    }

    const asset = readyItem
      ? {
          url: buildReadyAssetUrl(ref.grade, ref.key, readyItem),
          contentType: readyItem.contentType ?? 'image/png',
          width,
          height,
        }
      : {
          ...DUMMY_IMAGE_ASSET,
          width,
          height,
        };

    entries.push([ref.key, asset]);
  }

  return Object.fromEntries(entries);
};

export const execRenderToDocument = async (
  snapshot: CreatePdfPreviewSnapshot,
  images: ImageAssetMap,
): Promise<void> => {
  clearViewerDocument(document);
  ensureKatexFontStyle(document);
  ensureKatexStyle(document);
  ensureKatexOverrideStyle(document);
  const layoutState = buildLayoutStateFromCreatePdfSnapshot(snapshot, images);
  await fullRenderPreview(layoutState, document, images);
  ensureDisplayModeStyle(document, 'print');
};

export const toErrorResult = (
  error: string,
): CreatePdfExportManifestResult => ({
  ok: false,
  error,
});

export const filterReadyItemsBySnapshot = (
  snapshot: CreatePdfPreviewSnapshot,
  readyItemsByKey: ReadonlyMap<string, AssetReadyNotice>,
): Map<string, AssetReadyNotice> => {
  const nextReadyItems = new Map<string, AssetReadyNotice>();

  for (const ref of collectRequiredImageRefs(snapshot)) {
    const readyItem = readyItemsByKey.get(toAssetCacheKey(ref));
    if (readyItem) {
      nextReadyItems.set(toAssetCacheKey(ref), readyItem);
    }
  }

  return nextReadyItems;
};

export const previewWindowBridgeChannel = createPreviewWindowBridgeChannel();

const applyReadyImagesToDocument = async (
  snapshot: CreatePdfPreviewSnapshot,
  readyItems: readonly AssetReadyNotice[],
): Promise<void> => {
  if (!document.body) {
    console.warn('[createPdfPreviewWindow] image patch skipped: body missing');
    return;
  }
  const images = await buildImageAssetMap(snapshot, readyItems);
  realizeDomImages(document.body, images);
};

export type PreviewRenderProgress =
  | { phase: 'start'; sequence: number }
  | { phase: 'read-document'; sequence: number }
  | { phase: 'select-snapshot'; sequence: number }
  | { phase: 'request-assets'; sequence: number }
  | { phase: 'full-render'; sequence: number }
  | { phase: 'complete'; sequence: number }
  | { phase: 'error'; sequence: number; message: string };

type PreviewRenderProgressHandler = (progress: PreviewRenderProgress) => void;

// useEffect ではなくモジュールレベルで登録（マウント/アンマウントに依存しない）
(window as BrowserWindowWithBridge)[BRIDGE_KEY] = {
  getStatus: previewWindowBridgeChannel.getStatus,
  getManifest: previewWindowBridgeChannel.getManifest,
  setDisplayMode: (mode) => ensureDisplayModeStyle(document, mode), // ← 追加
};

export class PreviewRenderController {
  private cancelled = false;
  private pendingReadyPatch = false;

  constructor(
    private readonly creationType: CreationType,
    private readonly slotKey: string,
    private readonly renderSequenceRef: RefObject<number>,
    private readonly relevantAssetKeysRef: RefObject<Set<string>>,
    private readonly renderCacheRef: RefObject<CreatePdfPreviewWindowRenderCache | null>,
    private readonly onProgress?: PreviewRenderProgressHandler,
  ) {}

  cancel(): void {
    this.cancelled = true;
  }

  private notifyProgress(progress: PreviewRenderProgress): void {
    this.onProgress?.(progress);
  }

  requestApplyReadyImagesFromCache(): void {
    if (this.cancelled || !this.renderCacheRef.current) return;
    if (previewWindowBridgeChannel.getStatus().isRendering) {
      this.pendingReadyPatch = true;
      return;
    }
    this.applyReadyImagesFromCache();
  }

  applyReadyImagesFromCache(): void {
    const renderCache = this.renderCacheRef.current;
    if (!renderCache) return;

    try {
      void applyReadyImagesToDocument(
        renderCache.snapshot,
        Array.from(renderCache.readyItemsByKey.values()),
      ).catch((error) => {
        console.error('[createPdfPreviewWindow] image patch failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      console.error('[createPdfPreviewWindow] image patch failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async renderPreview(): Promise<number | null> {
    const currentSequence = ++this.renderSequenceRef.current;
    let terminalProgress: 'complete' | 'error' | null = null;
    let renderedRevision: number | null = null;
    console.log('[DEBUG:renderPreview] start', {
      creationType: this.creationType,
      slotKey: this.slotKey,
      seq: currentSequence,
    });
    this.notifyProgress({ phase: 'start', sequence: currentSequence });
    previewWindowBridgeChannel.setStatus({
      isOpen: true,
      isReady: false,
      creationType: this.creationType,
      slotKey: this.slotKey,
      revision: null,
      isRendering: true,
    });
    previewWindowBridgeChannel.setManifest(
      toErrorResult('プレビューウィンドウを描画中です。'),
    );

    try {
      this.notifyProgress({
        phase: 'read-document',
        sequence: currentSequence,
      });
      const readResult = await readCreatePdfPreviewDocument(this.creationType);
      if (this.cancelled || currentSequence !== this.renderSequenceRef.current)
        return null;
      if (!readResult.ok) {
        console.warn('[DEBUG:renderPreview] readDocument failed', {
          error: readResult.error,
          seq: currentSequence,
        });
        previewWindowBridgeChannel.setStatus({
          isOpen: true,
          isReady: false,
          creationType: this.creationType,
          slotKey: this.slotKey,
          revision: null,
          isRendering: false,
        });
        previewWindowBridgeChannel.setManifest(toErrorResult(readResult.error));
        terminalProgress = 'error';
        this.notifyProgress({
          phase: 'error',
          sequence: currentSequence,
          message: readResult.error,
        });
        return null;
      }

      this.notifyProgress({
        phase: 'select-snapshot',
        sequence: currentSequence,
      });
      const slot = selectSlot(readResult.document, this.slotKey);
      console.log('[DEBUG:renderPreview] slot check', {
        docRevision: readResult.document.revision,
        slotKey: this.slotKey,
        hasSlot: slot !== null,
        hasPreviewSnapshot: !!slot?.previewSnapshot,
        seq: currentSequence,
      });
      if (!slot?.previewSnapshot) {
        this.relevantAssetKeysRef.current = new Set();
        this.renderCacheRef.current = null;
        previewWindowBridgeChannel.setStatus({
          isOpen: true,
          isReady: false,
          creationType: this.creationType,
          slotKey: this.slotKey,
          revision: readResult.document.revision,
          isRendering: false,
        });
        previewWindowBridgeChannel.setManifest(
          toErrorResult('指定 slotKey の previewSnapshot が見つかりません。'),
        );
        terminalProgress = 'error';
        this.notifyProgress({
          phase: 'error',
          sequence: currentSequence,
          message: '指定 slotKey の previewSnapshot が見つかりません。',
        });
        return null;
      }
      const previewSnapshot = slot.previewSnapshot;

      const assetKeys = toAssetKey(previewSnapshot);
      this.relevantAssetKeysRef.current = new Set(
        assetKeys.map(toAssetCacheKey),
      );
      const nextRenderCache: CreatePdfPreviewWindowRenderCache = {
        snapshot: previewSnapshot,
        revision: readResult.document.revision,
        readyItemsByKey: filterReadyItemsBySnapshot(
          previewSnapshot,
          this.renderCacheRef.current?.readyItemsByKey ?? new Map(),
        ),
      };
      this.renderCacheRef.current = nextRenderCache;

      this.notifyProgress({
        phase: 'request-assets',
        sequence: currentSequence,
      });
      const assetResult =
        assetKeys.length > 0
          ? await window.assets.request(assetKeys)
          : { ok: true as const, ready: [], pending: [] };

      if (this.cancelled || currentSequence !== this.renderSequenceRef.current)
        return null;
      if (!assetResult.ok) {
        previewWindowBridgeChannel.setStatus({
          isOpen: true,
          isReady: false,
          creationType: this.creationType,
          slotKey: this.slotKey,
          revision: readResult.document.revision,
          isRendering: false,
        });
        previewWindowBridgeChannel.setManifest(
          toErrorResult(assetResult.error),
        );
        terminalProgress = 'error';
        this.notifyProgress({
          phase: 'error',
          sequence: currentSequence,
          message: assetResult.error,
        });
        return null;
      }

      for (const readyItem of assetResult.ready) {
        nextRenderCache.readyItemsByKey.set(
          toAssetCacheKey(readyItem),
          readyItem,
        );
      }
      nextRenderCache.readyItemsByKey = filterReadyItemsBySnapshot(
        previewSnapshot,
        nextRenderCache.readyItemsByKey,
      );

      const images = await buildImageAssetMap(
        previewSnapshot,
        Array.from(nextRenderCache.readyItemsByKey.values()),
      );
      this.notifyProgress({
        phase: 'full-render',
        sequence: currentSequence,
      });
      console.log('レンダー開始');
      await execRenderToDocument(previewSnapshot, images);
      console.log('レンダー終了');
      if (this.cancelled || currentSequence !== this.renderSequenceRef.current)
        return null;

      console.log('[DEBUG:renderPreview] isReady=true', {
        revision: readResult.document.revision,
        seq: currentSequence,
      });
      renderedRevision = readResult.document.revision;
      previewWindowBridgeChannel.setStatus({
        isOpen: true,
        isReady: true,
        creationType: this.creationType,
        slotKey: this.slotKey,
        revision: readResult.document.revision,
        isRendering: false,
      });
      previewWindowBridgeChannel.setManifestBuilder((options) =>
        buildCreatePdfExportManifest({
          slotKey: this.slotKey,
          revision: readResult.document.revision,
          snapshot: previewSnapshot,
          root: document,
          options,
        }),
      );
    } catch (error) {
      if (this.cancelled || currentSequence !== this.renderSequenceRef.current)
        return null;
      const message = error instanceof Error ? error.message : String(error);
      terminalProgress = 'error';
      console.error('[DEBUG:renderPreview] render error', {
        message,
        seq: currentSequence,
      });
      previewWindowBridgeChannel.setStatus({
        isOpen: true,
        isReady: false,
        creationType: this.creationType,
        slotKey: this.slotKey,
        revision: previewWindowBridgeChannel.getStatus().revision,
        isRendering: false,
      });
      previewWindowBridgeChannel.setManifest(toErrorResult(message));
      this.notifyProgress({
        phase: 'error',
        sequence: currentSequence,
        message,
      });
    } finally {
      if (
        !this.cancelled &&
        currentSequence === this.renderSequenceRef.current
      ) {
        previewWindowBridgeChannel.setStatus({
          ...previewWindowBridgeChannel.getStatus(),
          isRendering: false,
        });
        if (terminalProgress === null) {
          this.notifyProgress({
            phase: 'complete',
            sequence: currentSequence,
          });
        } else {
          this.notifyProgress({
            phase: 'error',
            sequence: currentSequence,
            message: '描画中にエラーが発生しました。',
          });
        }
        if (this.pendingReadyPatch) {
          this.pendingReadyPatch = false;
          this.requestApplyReadyImagesFromCache();
        }
      }
    }
    return renderedRevision;
  }
}

import { requestCreatePdfPreviewUpdate } from '@renderer/api/createPdfExportBridge';
import { subscribeCreatePdfPreviewUpdated } from '@renderer/api/pdfPreviewBridge';
import type {
  CreatePdfPreviewUpdatedEvent,
  CreationType,
} from '@shared/types/pdfPreview';
import viewerHtml from '@templates/preview/viewer.html?raw';
import examViewerHtml from '@templates/preview/viewer-exam.html?raw';
import { Button } from '@ui/button';
import { CLOSED_STATUS } from '@views/createPdfPreview/types/createPdfType';
import {
  type ChangeEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation } from 'react-router';
import {
  PreviewRenderController,
  type PreviewRenderProgress,
  previewWindowBridgeChannel,
  toAssetCacheKey,
  toErrorResult,
} from './api/previewRenderController';
import type { CreatePdfPreviewWindowRenderCache } from './types/createPdfType';

const STYLE_DATASET = 'data-create-pdf-preview-window-style';
const PREVIEW_ROOT_ATTR = 'data-create-pdf-preview-root';
const BOX_MODEL_STYLE_DATASET = 'data-create-pdf-preview-window-box-model';
const LOADING_TOTAL_STEPS = 5;
const LOADING_BALL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const TOOLBAR_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  height: '56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '0 16px',
  backgroundColor: '#F5F6F8',
  boxShadow: '0 1px 3px 0 hsl(0 0% 0% / 0.12)',
  fontFamily: "'NotoSansJP_400Regular', 'Roboto', sans-serif",
};

const PENDING_UPDATE_MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  marginRight: 'auto',
  color: 'var(--color-error-text)',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.5,
};

const AUTO_UPDATE_LABEL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--color-foreground)',
  fontSize: '14px',
  lineHeight: 1.5,
};

const AUTO_UPDATE_CHECKBOX_STYLE: CSSProperties = {
  width: '16px',
  height: '16px',
  accentColor: 'var(--color-primary)',
};

const PREVIEW_HOST_STYLE: CSSProperties = {
  paddingTop: '56px',
};

type PreviewWindowLoadingState =
  | { visible: false }
  | {
      visible: true;
      sequence: number;
      step: number;
      label: string;
      detail: string;
    };

const PREVIEW_LOADING_STYLE = `
  .create-pdf-preview-loading-spinner {
    position: relative;
    width: 100px;
    height: 100px;
  }

  .create-pdf-preview-loading-ball {
    width: 50%;
    height: 20px;
    position: absolute;
    top: calc(50% - 10px);
    transform-origin: 100% 50%;
    left: 0;
  }

  .create-pdf-preview-loading-ball::before {
    content: '';
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color:  #f5f6f8;
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    animation: create-pdf-preview-ball-spinner 1s linear infinite;
  }

  .create-pdf-preview-loading-ball-2 {
    transform: rotate(45deg);
  }

  .create-pdf-preview-loading-ball-2::before {
    animation-delay: -0.125s;
  }

  .create-pdf-preview-loading-ball-3 {
    transform: rotate(90deg);
  }

  .create-pdf-preview-loading-ball-3::before {
    animation-delay: -0.25s;
  }

  .create-pdf-preview-loading-ball-4 {
    transform: rotate(135deg);
  }

  .create-pdf-preview-loading-ball-4::before {
    animation-delay: -0.375s;
  }

  .create-pdf-preview-loading-ball-5 {
    transform: rotate(180deg);
  }

  .create-pdf-preview-loading-ball-5::before {
    animation-delay: -0.5s;
  }

  .create-pdf-preview-loading-ball-6 {
    transform: rotate(225deg);
  }

  .create-pdf-preview-loading-ball-6::before {
    animation-delay: -0.625s;
  }

  .create-pdf-preview-loading-ball-7 {
    transform: rotate(270deg);
  }

  .create-pdf-preview-loading-ball-7::before {
    animation-delay: -0.75s;
  }

  .create-pdf-preview-loading-ball-8 {
    transform: rotate(315deg);
  }

  .create-pdf-preview-loading-ball-8::before {
    animation-delay: -0.875s;
  }

  @keyframes create-pdf-preview-ball-spinner {
    0% {
      width: 20px;
      height: 20px;
      opacity: 1;
    }
    100% {
      width: 6px;
      height: 6px;
      opacity: .2;
      margin-left: 7px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .create-pdf-preview-loading-ball::before {
      animation: none;
      opacity: .75;
    }
  }
`;

const removeInjectedStyles = (doc: Document): void => {
  const nodes = Array.from(doc.head.querySelectorAll(`[${STYLE_DATASET}]`));
  for (const node of nodes) {
    node.remove();
  }
};

const ensurePreviewWindowBoxModelStyle = (doc: Document): void => {
  const prev = doc.head.querySelector(`[${BOX_MODEL_STYLE_DATASET}]`);
  if (prev) return;

  const style = doc.createElement('style');
  style.setAttribute(BOX_MODEL_STYLE_DATASET, '1');
  style.textContent = `
    [${PREVIEW_ROOT_ATTR}] {
      line-height: normal !important;
    }
  `;
  doc.head.appendChild(style);
};

const removePreviewWindowBoxModelStyle = (doc: Document): void => {
  const node = doc.head.querySelector(`[${BOX_MODEL_STYLE_DATASET}]`);
  node?.remove();
};

const applyViewerTemplate = (
  doc: Document,
  host: HTMLDivElement,
  template: string,
): void => {
  const parsed = new DOMParser().parseFromString(template, 'text/html');
  removeInjectedStyles(doc);

  for (const style of Array.from(parsed.head.querySelectorAll('style'))) {
    const nextStyle = doc.createElement('style');
    nextStyle.setAttribute(STYLE_DATASET, '1');
    nextStyle.textContent = style.textContent;
    doc.head.appendChild(nextStyle);
  }

  host.setAttribute(PREVIEW_ROOT_ATTR, '1');
  ensurePreviewWindowBoxModelStyle(doc);

  doc.title = parsed.title || 'createPdf preview';
  host.innerHTML = parsed.body.innerHTML;
};

const toLoadingState = ({
  phase,
  sequence,
}: PreviewRenderProgress): PreviewWindowLoadingState => {
  switch (phase) {
    case 'start':
    case 'read-document':
      return {
        visible: true,
        sequence,
        step: 1,
        label: 'プレビューを準備中です',
        detail: '読み込みを開始しています',
      };
    case 'select-snapshot':
      return {
        visible: true,
        sequence,
        step: 2,
        label: 'プレビュー情報を読み込んでいます',
        detail: '表示対象を確認しています',
      };
    case 'request-assets':
      return {
        visible: true,
        sequence,
        step: 3,
        label: '画像を確認しています',
        detail: '必要な画像を読み込んでいます',
      };
    case 'full-render':
      return {
        visible: true,
        sequence,
        step: 4,
        label: 'レイアウトを整理しています',
        detail: 'ページ構成を計算しています',
      };
    case 'complete':
      return {
        visible: true,
        sequence,
        step: 5,
        label: 'プレビューを表示します',
        detail: 'レンダリングが完了しました',
      };
    case 'error':
      return { visible: false };
  }
};

const CreatePdfPreviewLoadingOverlay = ({
  detail,
  label,
  step,
}: Extract<PreviewWindowLoadingState, { visible: true }>) => (
  <div
    aria-live="polite"
    data-create-pdf-preview-loading-overlay=""
    role="status"
  >
    <style>{PREVIEW_LOADING_STYLE}</style>
    <div>
      <div aria-hidden="true" className="create-pdf-preview-loading-spinner">
        {LOADING_BALL_NUMBERS.map((ballNumber) => (
          <span
            className={`create-pdf-preview-loading-ball create-pdf-preview-loading-ball-${ballNumber}`}
            key={ballNumber}
          />
        ))}
      </div>
      <div>
        <p>{label}</p>
        <p>{detail}</p>
        <p>
          {step}/{LOADING_TOTAL_STEPS}
        </p>
      </div>
    </div>
  </div>
);

// slot ごとに最新 updated event を管理するモジュールレベルの仕組み
// useSyncExternalStore の subscribe として使う
const _previewDocUpdateMap = new Map<string, CreatePdfPreviewUpdatedEvent>();
const _previewDocUpdateListeners = new Set<() => void>();

subscribeCreatePdfPreviewUpdated((event) => {
  const key = `${event.creationType}/${event.slotKey}`;
  const previous = _previewDocUpdateMap.get(key);
  if (previous && previous.revision >= event.revision) return;

  _previewDocUpdateMap.set(key, event);
  for (const fn of _previewDocUpdateListeners) fn();
});

// subscribe 関数はモジュールレベルで安定させる
const subscribePreviewDocUpdates = (listener: () => void) => {
  _previewDocUpdateListeners.add(listener);
  return () => {
    _previewDocUpdateListeners.delete(listener);
  };
};

const newerByRevision = (
  current: CreatePdfPreviewUpdatedEvent | null,
  next: CreatePdfPreviewUpdatedEvent,
): CreatePdfPreviewUpdatedEvent =>
  current && current.revision >= next.revision ? current : next;

type PreviewRenderReason =
  | 'initial'
  | 'auto'
  | 'manual'
  | 'recovery'
  | 'pending';

const CreatePdfPreviewWindowView = () => {
  const location = useLocation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderSequenceRef = useRef(0);
  const relevantAssetKeysRef = useRef<Set<string>>(new Set());
  const renderCacheRef = useRef<CreatePdfPreviewWindowRenderCache | null>(null);
  const controllerRef = useRef<PreviewRenderController | null>(null);
  const loadingFrameRef = useRef<number | null>(null);
  const hasCompletedInitialLoadingRef = useRef(false);
  const loadingSequenceRef = useRef<number | null>(null);
  const autoUpdateEnabledRef = useRef(true);
  const suppressedUpdateRef = useRef<CreatePdfPreviewUpdatedEvent | null>(null);
  const pendingRenderUpdateRef = useRef<CreatePdfPreviewUpdatedEvent | null>(
    null,
  );
  const manualUpdateRequestedRef = useRef(false);
  const renderedRevisionRef = useRef<number | null>(null);
  const activeRenderFollowsUpdateRef = useRef(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [hasSuppressedUpdate, setHasSuppressedUpdate] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [loadingState, setLoadingState] = useState<PreviewWindowLoadingState>({
    visible: false,
  });

  const { creationType, slotKey, template } = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const creationTypeParam = searchParams.get('creationType');
    const creationType: CreationType | null =
      creationTypeParam === 'exam' || creationTypeParam === 'workbook'
        ? creationTypeParam
        : null;
    const slotKey = searchParams.get('slotKey') ?? null;
    const template = creationType === 'exam' ? examViewerHtml : viewerHtml;
    return { creationType, slotKey, template };
  }, [location.search]);

  const previewUpdateEvent = useSyncExternalStore(
    subscribePreviewDocUpdates,
    () => _previewDocUpdateMap.get(`${creationType}/${slotKey}`) ?? null,
  );

  const previewHostStyle = useMemo<CSSProperties>(
    () => ({
      ...PREVIEW_HOST_STYLE,
      visibility: isPreviewVisible ? 'visible' : 'hidden',
    }),
    [isPreviewVisible],
  );

  const clearPendingLoadingFrame = useCallback(() => {
    if (loadingFrameRef.current === null) return;
    window.cancelAnimationFrame(loadingFrameRef.current);
    loadingFrameRef.current = null;
  }, []);

  const setSuppressedUpdate = useCallback(
    (next: CreatePdfPreviewUpdatedEvent | null) => {
      suppressedUpdateRef.current = next;
      setHasSuppressedUpdate(next !== null);
    },
    [],
  );

  const keepLatestSuppressedUpdate = useCallback(
    (event: CreatePdfPreviewUpdatedEvent) => {
      setSuppressedUpdate(newerByRevision(suppressedUpdateRef.current, event));
    },
    [setSuppressedUpdate],
  );

  const keepLatestPendingRenderUpdate = useCallback(
    (event: CreatePdfPreviewUpdatedEvent) => {
      pendingRenderUpdateRef.current = newerByRevision(
        pendingRenderUpdateRef.current,
        event,
      );
    },
    [],
  );

  const clearSuppressedUpdateIfRendered = useCallback(
    (revision: number) => {
      const suppressedUpdate = suppressedUpdateRef.current;
      if (!suppressedUpdate || revision < suppressedUpdate.revision) return;
      setSuppressedUpdate(null);
    },
    [setSuppressedUpdate],
  );

  const requestPreviewUpdate = useCallback(() => {
    if (!creationType || !slotKey) return;

    manualUpdateRequestedRef.current = true;
    hasCompletedInitialLoadingRef.current = false;
    loadingSequenceRef.current = null;
    clearPendingLoadingFrame();
    setLoadingState({ visible: false });

    void requestCreatePdfPreviewUpdate({ creationType, slotKey }).then(
      (result) => {
        if (!result.ok) {
          manualUpdateRequestedRef.current = false;
          console.error('[createPdfPreviewWindow] update request failed', {
            error: result.error,
          });
        }
      },
    );
  }, [creationType, slotKey, clearPendingLoadingFrame]);

  const hideLoadingAfterNextFrame = useCallback(
    (sequence: number) => {
      clearPendingLoadingFrame();
      loadingFrameRef.current = window.requestAnimationFrame(() => {
        loadingFrameRef.current = null;
        setLoadingState((current) => {
          if (!current.visible || current.sequence !== sequence) {
            return current;
          }
          return { visible: false };
        });
      });
    },
    [clearPendingLoadingFrame],
  );

  const handleRenderProgress = useCallback(
    (progress: PreviewRenderProgress) => {
      if (progress.sequence !== renderSequenceRef.current) return;

      if (progress.phase === 'error') {
        clearPendingLoadingFrame();
        setIsPreviewVisible(false);
        setLoadingState((current) => {
          if (!current.visible || current.sequence !== progress.sequence) {
            return current;
          }
          return { visible: false };
        });
        return;
      }

      if (progress.phase === 'start') {
        clearPendingLoadingFrame();
        setIsPreviewVisible(false);

        if (hasCompletedInitialLoadingRef.current) {
          loadingSequenceRef.current = null;
          setLoadingState({ visible: false });
          return;
        }

        loadingSequenceRef.current = progress.sequence;
      } else if (
        progress.phase === 'complete' &&
        loadingSequenceRef.current !== progress.sequence
      ) {
        hasCompletedInitialLoadingRef.current = true;
        setIsPreviewVisible(true);
        return;
      } else if (loadingSequenceRef.current !== progress.sequence) {
        return;
      }

      setLoadingState(toLoadingState(progress));

      if (progress.phase === 'complete') {
        hasCompletedInitialLoadingRef.current = true;
        setIsPreviewVisible(true);
        hideLoadingAfterNextFrame(progress.sequence);
        return;
      }

      clearPendingLoadingFrame();
    },
    [clearPendingLoadingFrame, hideLoadingAfterNextFrame],
  );

  const startRender = useCallback(
    (
      event: CreatePdfPreviewUpdatedEvent | null,
      reason: PreviewRenderReason,
    ) => {
      if (!creationType || !slotKey || !hostRef.current) return;

      const renderedRevision = renderedRevisionRef.current;
      if (
        event &&
        renderedRevision !== null &&
        event.revision <= renderedRevision
      ) {
        clearSuppressedUpdateIfRendered(renderedRevision);
        return;
      }

      controllerRef.current?.cancel();
      const controller = new PreviewRenderController(
        creationType,
        slotKey,
        renderSequenceRef,
        relevantAssetKeysRef,
        renderCacheRef,
        handleRenderProgress,
      );
      controllerRef.current = controller;
      activeRenderFollowsUpdateRef.current =
        autoUpdateEnabledRef.current ||
        reason === 'manual' ||
        reason === 'pending';

      void controller.renderPreview().then((revision) => {
        if (controllerRef.current !== controller || revision === null) return;

        const previousRenderedRevision = renderedRevisionRef.current;
        renderedRevisionRef.current = revision;
        clearSuppressedUpdateIfRendered(revision);

        const pendingUpdate = pendingRenderUpdateRef.current;
        if (!pendingUpdate) return;

        if (revision >= pendingUpdate.revision) {
          pendingRenderUpdateRef.current = null;
          return;
        }

        if (
          previousRenderedRevision !== null &&
          revision <= previousRenderedRevision
        )
          return;

        startRender(pendingUpdate, 'pending');
      });
    },
    [
      creationType,
      slotKey,
      handleRenderProgress,
      clearSuppressedUpdateIfRendered,
    ],
  );

  const handleAutoUpdateEnabledChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.checked;
      autoUpdateEnabledRef.current = next;
      setAutoUpdateEnabled(next);

      if (!next) return;

      const suppressedUpdate = suppressedUpdateRef.current;
      if (!suppressedUpdate) return;

      if (previewWindowBridgeChannel.getStatus().isRendering) {
        keepLatestPendingRenderUpdate(suppressedUpdate);
        return;
      }

      startRender(suppressedUpdate, 'recovery');
    },
    [keepLatestPendingRenderUpdate, startRender],
  );

  // templateの適用
  // biome-ignore lint/correctness/useExhaustiveDependencies: creationTypeとtemplateは同時に変更される。2回走ってしまうためtemplateのみで良い
  useLayoutEffect(() => {
    if (!hostRef.current || !creationType) {
      return;
    }

    applyViewerTemplate(document, hostRef.current, template);

    return () => {
      removeInjectedStyles(document);
      removePreviewWindowBoxModelStyle(document);
      if (hostRef.current) {
        hostRef.current.innerHTML = '';
        hostRef.current.removeAttribute(PREVIEW_ROOT_ATTR);
      }
    };
  }, [template]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 対象変更は slotKey に集約する。creationType も実質 slotKey と一体で扱われる既存設計をここで吸収する。
  useEffect(() => {
    hasCompletedInitialLoadingRef.current = false;
    loadingSequenceRef.current = null;
    clearPendingLoadingFrame();
    setIsPreviewVisible(false);
    setLoadingState({ visible: false });
    setSuppressedUpdate(null);
    pendingRenderUpdateRef.current = null;
    manualUpdateRequestedRef.current = false;
    renderedRevisionRef.current = null;
    activeRenderFollowsUpdateRef.current = false;

    if (!creationType || !slotKey || !hostRef.current) {
      clearPendingLoadingFrame();
      setIsPreviewVisible(false);
      setLoadingState({ visible: false });
      relevantAssetKeysRef.current = new Set();
      renderCacheRef.current = null;
      previewWindowBridgeChannel.setStatus({
        ...CLOSED_STATUS,
        creationType,
        slotKey,
      });
      previewWindowBridgeChannel.setManifest(
        toErrorResult(
          'PreviewWindow の creationType または slotKey が不正です。',
        ),
      );
      return;
    }

    startRender(null, 'initial');
    const unsubscribeAssetReady = window.assets.onReady((item) => {
      const key = toAssetCacheKey(item);
      if (!relevantAssetKeysRef.current.has(key)) return;
      const renderCache = renderCacheRef.current;
      if (!renderCache) return;
      const previousItem = renderCache.readyItemsByKey.get(key);
      // 同一version・同一tokenでも、DOMに失敗マーカーが残っている場合の再適用を
      // 妨げないよう、ready通知は常に反映する（設計10.5）。
      if (
        previousItem?.version === item.version &&
        previousItem?.recoveryToken === item.recoveryToken &&
        previousItem?.contentType === item.contentType
      ) {
        controllerRef.current?.requestApplyReadyImagesFromCache();
        return;
      }
      renderCache.readyItemsByKey.set(key, item);
      controllerRef.current?.requestApplyReadyImagesFromCache(); // ref 経由で呼ぶ
    });

    return () => {
      unsubscribeAssetReady();
      controllerRef.current?.cancel();
      controllerRef.current = null;
      relevantAssetKeysRef.current = new Set();
      renderCacheRef.current = null;
    };
  }, [slotKey]);

  useEffect(() => {
    if (!previewUpdateEvent) return;

    const isRendering = previewWindowBridgeChannel.getStatus().isRendering;

    if (manualUpdateRequestedRef.current) {
      manualUpdateRequestedRef.current = false;
      if (isRendering) {
        keepLatestPendingRenderUpdate(previewUpdateEvent);
        activeRenderFollowsUpdateRef.current = true;
        return;
      }
      startRender(previewUpdateEvent, 'manual');
      return;
    }

    if (!autoUpdateEnabledRef.current) {
      if (isRendering && activeRenderFollowsUpdateRef.current) {
        keepLatestPendingRenderUpdate(previewUpdateEvent);
        return;
      }
      keepLatestSuppressedUpdate(previewUpdateEvent);
      return;
    }

    if (isRendering) {
      keepLatestPendingRenderUpdate(previewUpdateEvent);
      return;
    }

    startRender(previewUpdateEvent, 'auto');
  }, [
    previewUpdateEvent,
    keepLatestPendingRenderUpdate,
    keepLatestSuppressedUpdate,
    startRender,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみ実行したい
  useEffect(() => {
    return () => {
      clearPendingLoadingFrame();
    };
  }, []);

  return (
    <>
      <div data-create-pdf-preview-toolbar="" style={TOOLBAR_STYLE}>
        {hasSuppressedUpdate && (
          <p aria-live="polite" style={PENDING_UPDATE_MESSAGE_STYLE}>
            ※ 未反映の更新があります
          </p>
        )}
        <Button
          disabled={!creationType || !slotKey}
          onClick={requestPreviewUpdate}
          size="sm"
          type="button"
          variant="outline"
        >
          更新
        </Button>
        <label style={AUTO_UPDATE_LABEL_STYLE}>
          <input
            checked={autoUpdateEnabled}
            onChange={handleAutoUpdateEnabledChange}
            style={AUTO_UPDATE_CHECKBOX_STYLE}
            type="checkbox"
          />
          自動更新を有効にする
        </label>
      </div>
      <div
        data-create-pdf-preview-host=""
        ref={hostRef}
        style={previewHostStyle}
      />
      {loadingState.visible && (
        <CreatePdfPreviewLoadingOverlay {...loadingState} />
      )}
    </>
  );
};

export default CreatePdfPreviewWindowView;

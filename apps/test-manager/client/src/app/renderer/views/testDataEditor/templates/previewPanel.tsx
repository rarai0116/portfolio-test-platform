import type { DisplayMode } from '@api/ensurePdf';
import { realizeDomImages } from '@components/templates/preview/imageRealizer';
import { installImageErrorRecovery } from '@renderer/api/imageErrorRecovery';
import viewerHtml from '@renderer/components/templates/preview/viewer.html?raw';
import type {
  PreviewImagePatchPayload,
  PreviewResolvedPayload,
  PreviewSetPayload,
} from '@shared/types/preview';
import { usePreviewStore } from '@stores/usePreviewStore';
import {
  mergePreviewPayload,
  patchPreviewDom,
} from '@templates/preview/layout/patchRenderPreview';
import { Button } from '@ui/button';
import { Checkbox } from '@ui/checkbox';
import { Label } from '@ui/label';
import { Tabs, TabsList, TabsTrigger } from '@ui/tabs';
import {
  type PreviewUiOptions,
  renderPreviewToDocument,
} from '@views/testDataEditor/templates/previewRenderShared';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

type PreviewMode = 'both' | 'onlyQuestion' | 'onlyAnswer';

let externalPayload: PreviewSetPayload | null = null;

/**
 * 1回の描画に許す上限。描画側の待機が解決しない場合でも finally へ到達させ、
 * 排他フラグ（isRenderingRef）が立ったままパネルが固着するのを防ぐ。
 * 中断した描画の結果は採用せず、次の描画要求で描き直す。
 */
const RENDER_TIMEOUT_MS = 15000;

const subscribePreview = (notify: () => void) => {
  const off = window.preview.onSet((payload: PreviewSetPayload) => {
    console.log('Preview payload received:', payload);
    externalPayload = payload;
    notify();
  });
  return () => off();
};

// スナップショット取得関数
const getSnapshot = () => externalPayload;
const getServerSnapshot = () => null; // SSR不要なら null

type Props = {
  onInitialFullRenderDone?: () => void;
};

const PreviewPanel = ({ onInitialFullRenderDone }: Props) => {
  const id = useId();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { setLatest } = usePreviewStore();
  const lastPayloadRef = useRef<PreviewResolvedPayload | null>(null);
  const activeItemIdRef = useRef<string | null>(null);
  // iframe の準備完了を待つためのフラグ
  const isIframeReadyRef = useRef(false);
  // レンダリング排他制御とペンディング管理
  const isRenderingRef = useRef(false);
  const renderTokenRef = useRef(0);
  const hasReportedInitialFullRenderDoneRef = useRef(false);
  // レンダリング中に来た full 再描画要求を 1 回にまとめるフラグ（Bug 12）
  const pendingFullRenderRef = useRef(false);
  // finally から最新クロージャの renderPreview を呼ぶための ref（stale closure 対策）
  const renderPreviewRef = useRef<() => void>(() => {});

  // バッチレンダリング用ペンディング
  const batchPendingPayloadRef = useRef<Array<PreviewSetPayload>>([]);
  // 画像パッチ用ペンディング
  const batchPendingImagePatchRef = useRef<Array<PreviewImagePatchPayload>>([]);

  const [options, setOptions] = useState<PreviewUiOptions>({
    mode: 'both',
    hasCover: false, // デフォルトではoffにしておく
    page: { size: 'A4', pxPerMm: 0.2645, baseHeightMm: 235 },
    meta: { title: '' },
  });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('patch');

  // iframe 内に現在の latest + options で描画する共通関数
  // biome-ignore lint/correctness/useExhaustiveDependencies: 不要なため
  const renderPreview = useCallback(
    async (payload?: PreviewResolvedPayload) => {
      if (!isIframeReadyRef.current) return;

      // レンダリング中は再入させず、full 再描画要求だけ記録して抜ける（Bug 12）。
      // payload は保持しない。呼び出し側は直前に setLatest 済みで、finally からの
      // 引数なし再実行（store latest を seed）で最新内容に追従する。
      if (isRenderingRef.current) {
        pendingFullRenderRef.current = true;
        return;
      }

      const iframe = iframeRef.current;
      const doc =
        iframe?.contentDocument || iframe?.contentWindow?.document || null;
      if (!doc) return;

      const seed = payload ?? usePreviewStore.getState().latest;
      if (!seed) return;

      activeItemIdRef.current = String(seed.id);
      batchPendingPayloadRef.current = [];
      batchPendingImagePatchRef.current = [];

      isRenderingRef.current = true;
      const myToken = ++renderTokenRef.current;
      doc.documentElement.setAttribute('data-preview-rendering', '1');

      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      try {
        // 描画側の待機が解決しない場合に備え、上限時間で打ち切って finally へ抜ける。
        // 打ち切った描画は結果を採用しない（seed を確定させない）。
        const isRendered = await Promise.race([
          renderPreviewToDocument({
            doc,
            payload: seed,
            uiOptions: options,
            displayMode,
          }).then(() => true),
          new Promise<false>((resolve) => {
            timeoutId = setTimeout(() => resolve(false), RENDER_TIMEOUT_MS);
          }),
        ]);

        if (!isRendered) {
          console.warn(
            'renderPreview: 描画が上限時間内に完了しなかったため中断しました',
            { id: seed.id },
          );
        } else {
          if (!hasReportedInitialFullRenderDoneRef.current) {
            hasReportedInitialFullRenderDoneRef.current = true;
            onInitialFullRenderDone?.();
          }

          if (myToken === renderTokenRef.current) {
            lastPayloadRef.current = seed;
          }
        }
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);

        if (myToken === renderTokenRef.current) {
          isRenderingRef.current = false;
          doc.documentElement.removeAttribute('data-preview-rendering');

          // finally 節で return はしない（try 内の例外を握り潰すため）。if/else で分岐する。
          if (pendingFullRenderRef.current) {
            // レンダリング中に来た full 再描画要求を、最新 seed（store latest）で 1 回だけ実行。
            // 溜まっていた patch/画像キューは破棄する（受信 useEffect で store latest に
            // 反映済みのため、full 再描画に吸収される・Bug 12 補足4）。
            pendingFullRenderRef.current = false;
            batchPendingPayloadRef.current = [];
            batchPendingImagePatchRef.current = [];
            // ref 経由で最新クロージャの renderPreview を呼ぶ（stale closure 対策）
            setTimeout(() => renderPreviewRef.current(), 0);
          } else {
            const batchPending = batchPendingPayloadRef.current;
            batchPendingPayloadRef.current = [];
            const imagePending = batchPendingImagePatchRef.current;
            batchPendingImagePatchRef.current = [];

            if (batchPending.length > 0 || imagePending.length > 0) {
              setTimeout(async () => {
                // FIFO で適用する。pop()（LIFO）だと古い編集が後勝ちになり
                // 最新の編集が古い内容で上書きされてしまうため shift() を使う。
                let pendingPayload: PreviewSetPayload | undefined =
                  batchPending.shift();
                while (pendingPayload) {
                  await processPayload(pendingPayload);
                  pendingPayload = batchPending.shift();
                }

                let pendingImage: PreviewImagePatchPayload | undefined =
                  imagePending.shift();
                while (pendingImage) {
                  applyImagePatch(pendingImage);
                  pendingImage = imagePending.shift();
                }
              }, 0);
            }
          }
        }
      }
    },
    [options, displayMode],
  );

  // finally からの遅延再実行が常に最新の options/displayMode を参照するよう、
  // 毎レンダーで ref を最新クロージャに更新する（Bug 12・stale closure 対策）。
  renderPreviewRef.current = () => void renderPreview();

  // 画像パッチ適用
  const applyImagePatch = useCallback(
    (payload: PreviewImagePatchPayload) => {
      console.log('received applying image patch:', payload);

      // 現在表示中IDと一致する場合のみ適用（誤適用防止）
      if (
        activeItemIdRef.current &&
        String(payload.id) !== String(activeItemIdRef.current)
      ) {
        return;
      }

      if (lastPayloadRef.current) {
        lastPayloadRef.current = {
          ...lastPayloadRef.current,
          images: {
            ...(lastPayloadRef.current.images ?? {}),
            ...payload.images,
          },
        };
      }

      const latest = usePreviewStore.getState().latest;
      if (latest && String(latest.id) === String(payload.id)) {
        setLatest({
          ...latest,
          images: {
            ...(latest.images ?? {}),
            ...payload.images,
          },
        });
      }

      if (!isIframeReadyRef.current) return;
      const iframe = iframeRef.current;
      const doc =
        iframe?.contentDocument || iframe?.contentWindow?.document || null;
      if (!doc) return;

      // レンダリング中の場合、ペンディングに積む
      if (isRenderingRef.current) {
        batchPendingImagePatchRef.current.push(payload);
        return;
      }

      const containers = [
        doc.getElementById('title-container'),
        doc.getElementById('question-container'),
        doc.getElementById('answer-container'),
      ].filter(Boolean) as HTMLElement[];

      containers.forEach((el) => {
        realizeDomImages(el, payload.images);
      });
    },
    [setLatest],
  );

  const processPayload = useCallback(
    async (payload: PreviewSetPayload) => {
      if (!isIframeReadyRef.current) return;

      const iframe = iframeRef.current;
      const doc =
        iframe?.contentDocument || iframe?.contentWindow?.document || null;

      if (isRenderingRef.current) {
        batchPendingPayloadRef.current.push(payload);
        return;
      }

      if (displayMode === 'print') {
        if (payload.type === 'full') {
          setLatest(payload);
          await renderPreview(payload);
        }
        return;
      }

      if (payload.type === 'full') {
        setLatest(payload);
        await renderPreview(payload);
        return;
      }

      if (!doc || !lastPayloadRef.current) {
        return;
      }

      if (String(lastPayloadRef.current.id) !== String(payload.id)) {
        return;
      }

      const nextPayload = mergePreviewPayload(lastPayloadRef.current, payload);

      const patched = await patchPreviewDom(
        lastPayloadRef.current,
        nextPayload,
        payload,
        doc,
      );

      if (!patched) {
        setLatest(nextPayload);
        await renderPreview(nextPayload);
      } else {
        lastPayloadRef.current = nextPayload;
        setLatest(nextPayload);
      }
    },
    [displayMode, renderPreview, setLatest],
  );

  // iframe ロード時: main or store から latest を取得して描画
  const handleIframeLoad = useCallback(async () => {
    isIframeReadyRef.current = true;

    const doc =
      iframeRef.current?.contentDocument ||
      iframeRef.current?.contentWindow?.document ||
      null;
    // iframe document へも表示失敗回復を1回だけ設置する（設計10.2）
    installImageErrorRecovery(doc);
    const qc = doc?.getElementById('question-container');
    const ac = doc?.getElementById('answer-container');

    if (
      lastPayloadRef.current &&
      qc &&
      ac &&
      (qc.childElementCount > 0 || ac.childElementCount > 0)
    ) {
      return;
    }

    let seed = usePreviewStore.getState().latest;

    if (!seed) {
      const res = await window.preview.getLatest();
      if (res.ok && res.payload?.type === 'full') {
        seed = res.payload;
        setLatest(res.payload);
      }
    }

    if (!seed) return;
    await renderPreview(seed);
  }, [renderPreview, setLatest]);

  // 外部ストアから最新ペイロードを同期取得
  const activePayload = useSyncExternalStore(
    subscribePreview,
    getSnapshot,
    getServerSnapshot,
  );

  // 最新クロージャでのみ描画ロジックを起動（古い renderPreview / displayMode を参照しない）
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    if (!activePayload) return;

    const resolvedPayload =
      activePayload.type === 'full'
        ? activePayload
        : lastPayloadRef.current &&
            String(lastPayloadRef.current.id) === String(activePayload.id)
          ? mergePreviewPayload(lastPayloadRef.current, activePayload)
          : null;

    if (resolvedPayload) {
      setLatest(resolvedPayload);
      activeItemIdRef.current = String(resolvedPayload.id);
    }

    if (isRenderingRef.current) {
      batchPendingPayloadRef.current.push(activePayload);
      return;
    }

    void processPayload(activePayload);
  }, [activePayload]);

  // オプション変更時は latest を使って描画し直す
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionsの変更時に発動
  useEffect(() => {
    void renderPreview();
  }, [options, displayMode]);

  // 画像パッチ購読
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみ購読
  useEffect(() => {
    const off = window.preview.onImagePatch((p) => applyImagePatch(p));
    return () => off();
  }, []);

  const Controls = useMemo(
    () => (
      <div className="flex gap-4 px-4 py-3 items-center justify-between shadow">
        <div className="flex gap-3 items-center">
          <div className="text-xs text-nowrap tracking-tighter">
            表示切り替え：
          </div>
          <div className="flex items-center">
            <Checkbox
              id={`${id}-calibration-locked`}
              checked={options.hasCover}
              onCheckedChange={(e: boolean) => {
                setOptions((o) => ({ ...o, hasCover: e as boolean }));
              }}
            />
            <Label
              htmlFor={`${id}-calibration-locked`}
              className="text-xs text-nowrap ml-1 tracking-tight"
            >
              表紙・目次
            </Label>
          </div>
          <Tabs
            defaultValue="both"
            value={options.mode}
            onValueChange={(e) => {
              setOptions((o) => ({ ...o, mode: e as PreviewMode }));
            }}
          >
            <TabsList>
              <TabsTrigger value="both" className="tracking-tighter text-xs">
                問題・解説
              </TabsTrigger>
              <TabsTrigger
                value="onlyQuestion"
                className="tracking-tight text-xs"
              >
                問題のみ
              </TabsTrigger>
              <TabsTrigger
                value="onlyAnswer"
                className="tracking-tight text-xs"
              >
                解説のみ
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs
            defaultValue="patch"
            value={displayMode}
            onValueChange={(e) => {
              setDisplayMode(e as DisplayMode);
              console.log('event:', e, 'new display mode:', e);
            }}
          >
            <TabsList>
              <TabsTrigger value="patch" className="tracking-tight text-xs">
                パッチプレビュー
              </TabsTrigger>
              <TabsTrigger value="print" className="tracking-tight text-xs">
                印刷レイアウト
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void renderPreview();
          }}
        >
          更新
        </Button>
      </div>
    ),
    [options, displayMode, id, renderPreview],
  );

  return (
    <div className="flex flex-col w-full h-full bg-background gap-0.5">
      {Controls}
      <iframe
        ref={iframeRef}
        onLoad={handleIframeLoad}
        title="preview"
        className="flex-1 w-full border-none bg-background"
        srcDoc={viewerHtml}
      />
    </div>
  );
};

export default PreviewPanel;

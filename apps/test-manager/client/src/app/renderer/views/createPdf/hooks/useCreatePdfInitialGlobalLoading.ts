import { onCreatePdfPreviewWindowClosed } from '@renderer/api/createPdfExportBridge';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import { useCreatePdfPreviewUpdateControllerStore } from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore, {
  CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
} from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import type { PreviewCommitGuardReason } from '@views/createPdf/api/createPdfPreviewCommitKey';
import type { CreatePdfPreviewStatusKind } from '@views/createPdf/types/statusState';
import type { CreatePdfRouteMode } from '@views/createPdf/types/viewState';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

export const resolveInitialLoadingMessage = ({
  activeGuardReasons,
  hasCommitKey,
  isCommitting,
  isInitialStateSettled,
  isLoadingTestData,
  lastMetaCreationType,
  lastMetaRevision,
  lastMetaSlotKey,
  previewWindowCreationType,
  previewWindowIsOpen,
  previewWindowIsReady,
  previewWindowIsRendering,
  previewWindowRevision,
  previewWindowSlotKey,
  previewStatusKind,
}: {
  activeGuardReasons: readonly PreviewCommitGuardReason[];
  hasCommitKey: boolean;
  isCommitting: boolean;
  isInitialStateSettled: boolean;
  isLoadingTestData: boolean;
  lastMetaCreationType: string | null;
  lastMetaRevision: number | null;
  lastMetaSlotKey: string | null;
  previewWindowCreationType: string | null;
  previewWindowIsOpen: boolean;
  previewWindowIsReady: boolean;
  previewWindowIsRendering: boolean;
  previewWindowRevision: number | null;
  previewWindowSlotKey: string | null;
  previewStatusKind: CreatePdfPreviewStatusKind;
}): string | null => {
  if (!isInitialStateSettled) return 'PDF作成画面を準備中…';
  if (isLoadingTestData) return '問題データを読み込み中…';
  if (!hasCommitKey) return null;
  if (previewStatusKind === 'error') return null;
  if (
    activeGuardReasons.some(
      (reason) => reason.id === 'test-table-blocking-error',
    )
  ) {
    return null;
  }
  if (isCommitting || previewStatusKind === 'committing') {
    return 'プレビューを準備中…';
  }
  if (
    lastMetaRevision === null ||
    lastMetaCreationType === null ||
    lastMetaSlotKey === null
  ) {
    return 'プレビューを準備中…';
  }
  if (
    !previewWindowIsOpen ||
    previewWindowCreationType !== lastMetaCreationType ||
    previewWindowSlotKey !== lastMetaSlotKey
  ) {
    return 'PDFプレビューを起動中…';
  }
  if (previewWindowIsRendering || !previewWindowIsReady) {
    return 'PDFプレビューを描画中…';
  }
  if (previewWindowRevision !== lastMetaRevision) {
    return 'PDFプレビューを同期中…';
  }
  return null;
};

export const useCreatePdfInitialGlobalLoading = (
  routeMode: CreatePdfRouteMode,
  isInitialStateSettled: boolean,
): void => {
  const loadingIdRef = useRef<string | null>(null);
  const isDoneRef = useRef(false);
  const routeModeRef = useRef(routeMode);
  const { show, hide, setMessage } = useGlobalLoading();
  const setPreviewWindowStatus = useCreatePdfStatusRuntimeStore(
    (state) => state.actions.setPreviewWindowStatus,
  );
  const { isLoadingTestData } = useCreatePdfResourceStore(
    useShallow((state) => ({
      isLoadingTestData: state.testData.isLoading,
    })),
  );
  const {
    hasCommitKey,
    isCommitting,
    activeGuardReasons,
    lastMetaCreationType,
    lastMetaRevision,
    lastMetaSlotKey,
  } = useCreatePdfPreviewUpdateControllerStore(
    useShallow((state) => ({
      hasCommitKey: state.hasCommitKey,
      isCommitting: state.isCommitting,
      activeGuardReasons: state.activeGuardReasons,
      lastMetaCreationType: state.lastMeta?.creationType ?? null,
      lastMetaRevision: state.lastMeta?.revision ?? null,
      lastMetaSlotKey: state.lastMeta?.slotKey ?? null,
    })),
  );
  const {
    previewWindowCreationType,
    previewWindowIsOpen,
    previewWindowIsReady,
    previewWindowIsRendering,
    previewWindowRevision,
    previewWindowSlotKey,
  } = useCreatePdfStatusRuntimeStore(
    useShallow((state) => ({
      previewWindowCreationType: state.previewWindowStatus.creationType,
      previewWindowIsOpen: state.previewWindowStatus.isOpen,
      previewWindowIsReady: state.previewWindowStatus.isReady,
      previewWindowIsRendering: state.previewWindowStatus.isRendering,
      previewWindowRevision: state.previewWindowStatus.revision,
      previewWindowSlotKey: state.previewWindowStatus.slotKey,
    })),
  );
  const previewStatusKind = useCreatePdfStatusStore(
    (state) => state.previewStatus.kind,
  );

  const loadingMessage = resolveInitialLoadingMessage({
    activeGuardReasons,
    hasCommitKey,
    isCommitting,
    isInitialStateSettled,
    isLoadingTestData,
    lastMetaCreationType,
    lastMetaRevision,
    lastMetaSlotKey,
    previewWindowCreationType,
    previewWindowIsOpen,
    previewWindowIsReady,
    previewWindowIsRendering,
    previewWindowRevision,
    previewWindowSlotKey,
    previewStatusKind,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: ローディング制御
  useEffect(() => {
    if (routeModeRef.current !== routeMode) {
      routeModeRef.current = routeMode;
      isDoneRef.current = false;
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
    }

    if (isDoneRef.current) return;

    if (!loadingMessage) {
      isDoneRef.current = true;
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
      return;
    }

    if (loadingIdRef.current) {
      setMessage(loadingIdRef.current, loadingMessage);
      return;
    }

    loadingIdRef.current = show(loadingMessage);
  }, [loadingMessage, routeMode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: クリーンアップ用のエフェクト
  useEffect(() => {
    return () => {
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: PreviewWindow 閉鎖時は初期ローディングだけを即時終了する。
  useEffect(() => {
    return onCreatePdfPreviewWindowClosed(() => {
      setPreviewWindowStatus(CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS);
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
      isDoneRef.current = true;
    });
  }, []);
};

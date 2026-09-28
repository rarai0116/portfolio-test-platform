import {
  loadConditionJson,
  onCreatePdfPreviewWindowClosed,
} from '@renderer/api/createPdfExportBridge';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { TestData } from '@shared/types/contracts';
import type { CreatePdfPreviewCacheMeta } from '@shared/types/pdfPreview';
import {
  type AdjustedRowInfo,
  resolveConditionJsonShowQaaChoiceIndex,
  resolveConditionJsonToSnapshot,
} from '@views/createPdf/api/conditionJsonConverter';
import {
  type ConditionJsonImportSummary,
  type LegacyCategorySnapshot,
  resolveLoadedConditionJson,
  resolveLoadedConditionJsonImportMeta,
} from '@views/createPdf/api/conditionJsonImportResolver';
import {
  createExamDrawConditionKey,
  createWorkbookDrawConditionKey,
} from '@views/createPdf/api/createPdfConditionKeys';
import {
  createInitialExamState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import { deriveCreatePdfDrawConditionChangeStatus } from '@views/createPdf/api/createPdfDrawConditionChangeStatus';
import { useCreatePdfModeTransition } from '@views/createPdf/hooks/useCreatePdfModeTransition';
import {
  buildCreatePdfTestDataMaps,
  toGradeId,
} from '@views/createPdf/hooks/useCreatePdfTestData';
import { useCreatePdfPreviewUpdateControllerStore } from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfResourceStore, {
  buildCreatePdfTestCategoryCacheKey,
  CREATE_PDF_TEST_CATEGORY_SUBJECTS,
  createEmptyCreatePdfBigKeysBySubject,
} from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export type LoadConditionJsonDialogState = {
  isLoading: boolean;
  /** null = 非表示 */
  errorMessage: string | null;
  /** isDirty 確認ダイアログの表示状態 */
  isDirtyConfirmOpen: boolean;
  /** 読み込み結果サマリ。閉じるアニメーション中も内容を保持する */
  loadSummary: LoadConditionJsonResultSummary | null;
  /** 読み込み結果ダイアログの表示状態 */
  isLoadSummaryOpen: boolean;
  /** 反対モードJSON読込時のモード切替確認ダイアログの表示状態 */
  isModeChangeConfirmOpen: boolean;
};

export type LoadConditionJsonResultSummary = ConditionJsonImportSummary & {
  adjustedRowCount: number;
  clearedRowCount: number;
  failedRowCount: number;
};

type UseLoadConditionJsonReturn = {
  dialogState: LoadConditionJsonDialogState;
  /** JSON読込ボタン押下時のハンドラ */
  handleLoad: () => void;
  /** isDirtyConfirm で「続行」を押した時 */
  confirmProceed: () => void;
  /** isDirtyConfirm で「キャンセル」を押した時 */
  cancelProceed: () => void;
  /** エラーダイアログを閉じる */
  closeError: () => void;
  /** 読み込み結果ダイアログを閉じる */
  closeLoadSummary: () => void;
  /** モード切替確認ダイアログで「続行」を押した時 */
  confirmModeChange: () => void;
  /** モード切替確認ダイアログで「キャンセル」を押した時 */
  cancelModeChange: () => void;
};

const createInitialTableState = (showQaaChoiceIndex: boolean) => ({
  sections: [],
  sectionMode: 'single' as const,
  settings: { showQaaChoiceIndex },
  lastAppliedDrawConditionKey: null,
  lastSavedOrRestoredTableKey: null,
});

type CreatePdfTestDataMaps = ReturnType<typeof buildCreatePdfTestDataMaps>;

type JsonImportPhase = 'idle' | 'loading' | 'waiting-preview';

type PendingJsonImport = {
  baselineRevision: number | null;
  summary: LoadConditionJsonResultSummary;
};

export const isCreatePdfJsonImportPreviewCompleted = ({
  baselineRevision,
  isCommitting,
  isJsonLoading,
  lastMeta,
  previewWindowStatus,
}: {
  baselineRevision: number | null;
  isCommitting: boolean;
  isJsonLoading: boolean;
  lastMeta: CreatePdfPreviewCacheMeta | null;
  previewWindowStatus: ReturnType<
    typeof useCreatePdfStatusRuntimeStore.getState
  >['previewWindowStatus'];
}): boolean =>
  !isJsonLoading &&
  !isCommitting &&
  lastMeta !== null &&
  lastMeta.revision !== baselineRevision &&
  previewWindowStatus.isOpen &&
  previewWindowStatus.isReady &&
  !previewWindowStatus.isRendering &&
  previewWindowStatus.creationType === lastMeta.creationType &&
  previewWindowStatus.slotKey === lastMeta.slotKey &&
  previewWindowStatus.revision === lastMeta.revision;

export const isCreatePdfJsonImportPreviewWaitSkippable = ({
  baselineRevision,
  isCommitting,
  isJsonLoading,
  lastMeta,
  previewWindowStatus,
}: {
  baselineRevision: number | null;
  isCommitting: boolean;
  isJsonLoading: boolean;
  lastMeta: CreatePdfPreviewCacheMeta | null;
  previewWindowStatus: ReturnType<
    typeof useCreatePdfStatusRuntimeStore.getState
  >['previewWindowStatus'];
}): boolean =>
  !isJsonLoading &&
  !isCommitting &&
  lastMeta !== null &&
  lastMeta.revision !== baselineRevision &&
  !previewWindowStatus.isOpen;

export const createLoadConditionJsonResultSummary = (
  importSummary: ConditionJsonImportSummary,
  adjustedRows: AdjustedRowInfo[],
): LoadConditionJsonResultSummary => {
  const clearedRowCount = adjustedRows.filter(
    (row) => row.reason === 'cleared',
  ).length;
  return {
    ...importSummary,
    adjustedRowCount: adjustedRows.length,
    clearedRowCount,
    failedRowCount:
      importSummary.skippedRowCount +
      importSummary.blankedRowCount +
      importSummary.subjectMismatchRowCount +
      clearedRowCount,
  };
};

export const loadCreatePdfLegacyCategorySnapshot = async (params: {
  grade: 1 | 2;
  baseSubject: (typeof CREATE_PDF_TEST_CATEGORY_SUBJECTS)[number] | null;
}): Promise<LegacyCategorySnapshot | null> => {
  const gradeId = toGradeId(params.grade);
  const bigKeysBySubject = createEmptyCreatePdfBigKeysBySubject();
  const smallKeysBySubjectAndBig: Record<string, readonly string[]> = {};
  const subjects =
    params.baseSubject !== null
      ? [params.baseSubject]
      : CREATE_PDF_TEST_CATEGORY_SUBJECTS;

  for (const subject of subjects) {
    const bigResult = await window.testCategory.getKey(gradeId, subject);
    if (!bigResult.ok) continue;

    const bigKeys = Array.from(
      new Set(bigResult.keys.map((key) => key.trim()).filter(Boolean)),
    );
    bigKeysBySubject[subject] = bigKeys;

    for (const bigCategoryTag of bigKeys) {
      const smallResult = await window.testCategory.getKey(
        gradeId,
        subject,
        bigCategoryTag,
      );
      if (!smallResult.ok) continue;

      smallKeysBySubjectAndBig[
        buildCreatePdfTestCategoryCacheKey(subject, bigCategoryTag)
      ] = Array.from(
        new Set(smallResult.keys.map((key) => key.trim()).filter(Boolean)),
      );
    }
  }

  return { bigKeysBySubject, smallKeysBySubjectAndBig };
};

const setDraftGradeForCreationType = (
  creationType: 'workbook' | 'exam',
  grade: 1 | 2,
) => {
  if (creationType === 'workbook') {
    const state = useWorkbookDraftStore.getState();
    if (state.basic.grade !== grade) {
      state.actions.setBasic({ grade });
    }
    return;
  }

  const state = useExamDraftStore.getState();
  if (state.basic.grade !== grade) {
    state.actions.setBasic({ grade });
  }
};

const getDraftGradeForCreationType = (
  creationType: 'workbook' | 'exam',
): 1 | 2 =>
  creationType === 'workbook'
    ? useWorkbookDraftStore.getState().basic.grade
    : useExamDraftStore.getState().basic.grade;

export const loadCreatePdfTestDataMapsOnce = async (
  grade: 1 | 2,
): Promise<CreatePdfTestDataMaps> => {
  const collectionPath = toGradeId(grade);
  const actions = useCreatePdfResourceStore.getState().actions;

  actions.startTestDataLoad(grade);
  const result = await window.fs.getOnce({
    key: `createPdf:testData:${collectionPath}`,
    spec: { collectionPath, group: false },
  });
  const maps = buildCreatePdfTestDataMaps(
    result.docs.map((doc) => ({ data: doc.data as TestData | undefined })),
  );
  actions.setTestData({ maps, isLoading: false });
  return maps;
};

export const ensureCreatePdfImportTestDataMaps = async (params: {
  creationType: 'workbook' | 'exam';
  grade: 1 | 2;
}): Promise<CreatePdfTestDataMaps> => {
  const currentGrade = getDraftGradeForCreationType(params.creationType);
  setDraftGradeForCreationType(params.creationType, params.grade);

  const currentResource = useCreatePdfResourceStore.getState().testData;
  if (
    currentGrade === params.grade &&
    !currentResource.isLoading &&
    currentResource.maps.byNo.size > 0
  ) {
    return currentResource.maps;
  }

  return loadCreatePdfTestDataMapsOnce(params.grade);
};

const getHasUnappliedDrawConditions = (creationType: 'workbook' | 'exam') => {
  const testTableState = useTestTableStore.getState();
  const currentDrawConditionKey =
    creationType === 'workbook'
      ? createWorkbookDrawConditionKey({
          basic: useWorkbookDraftStore.getState().basic,
          stepTwo: useWorkbookDraftStore.getState().stepTwo,
        })
      : createExamDrawConditionKey({
          basic: useExamDraftStore.getState().basic,
          stepTwo: useExamDraftStore.getState().stepTwo,
        });

  return deriveCreatePdfDrawConditionChangeStatus({
    currentDrawConditionKey,
    lastAppliedDrawConditionKey: testTableState.lastAppliedDrawConditionKey,
    hasOutputRows: testTableState.sections.some((s) => s.rows.length > 0),
  }).hasUnappliedDrawConditions;
};

/**
 * JSON読込ボタンのロジックをカプセル化するフック。
 * templates 層から呼び出す。
 *
 * @param creationType 'workbook' | 'exam' — パネルの種別。
 *   creationType 不一致の JSON はエラーダイアログを表示して終了する。
 */
export const useLoadConditionJson = (
  creationType: 'workbook' | 'exam',
): UseLoadConditionJsonReturn => {
  const transitionCreatePdfMode = useCreatePdfModeTransition();
  const { show, hide, setMessage } = useGlobalLoading();
  const loadingIdRef = useRef<string | null>(null);
  const importActiveRef = useRef(false);
  const importOperationIdRef = useRef(0);
  const pendingImportRef = useRef<PendingJsonImport | null>(null);
  const [phase, setPhase] = useState<JsonImportPhase>('idle');
  const [pendingImport, setPendingImport] = useState<PendingJsonImport | null>(
    null,
  );
  const { isCommitting, isJsonLoading, lastCommitError, lastMeta } =
    useCreatePdfPreviewUpdateControllerStore(
      useShallow((state) => ({
        isCommitting: state.isCommitting,
        isJsonLoading: state.isJsonLoading,
        lastCommitError: state.lastCommitError,
        lastMeta: state.lastMeta,
      })),
    );
  const previewWindowStatus = useCreatePdfStatusRuntimeStore(
    (state) => state.previewWindowStatus,
  );

  const [dialogState, setDialogState] = useState<LoadConditionJsonDialogState>({
    isLoading: false,
    errorMessage: null,
    isDirtyConfirmOpen: false,
    loadSummary: null,
    isLoadSummaryOpen: false,
    isModeChangeConfirmOpen: false,
  });

  // isDirtyConfirm で「続行」を押した後に実行する処理を保持する
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);
  // モード切替確認ダイアログで「続行」を押した後に適用する filePath
  const pendingModeChangeFilePathRef = useRef<string | null>(null);

  const hideImportLoading = useCallback(() => {
    if (loadingIdRef.current === null) return;
    hide(loadingIdRef.current);
    loadingIdRef.current = null;
  }, [hide]);

  const cancelImportProgress = useCallback(
    (errorMessage?: string) => {
      importOperationIdRef.current += 1;
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.cancelJsonLoading();
      importActiveRef.current = false;
      pendingImportRef.current = null;
      setPendingImport(null);
      setPhase('idle');
      hideImportLoading();
      setDialogState((prev) => ({
        ...prev,
        isLoading: false,
        ...(errorMessage === undefined ? {} : { errorMessage }),
      }));
    },
    [hideImportLoading],
  );

  const beginImportProgress = useCallback(() => {
    cancelImportProgress();
    const baselineRevision =
      useCreatePdfPreviewUpdateControllerStore.getState().lastMeta?.revision ??
      null;
    useCreatePdfPreviewUpdateControllerStore
      .getState()
      .actions.beginJsonLoading();
    importActiveRef.current = true;
    pendingImportRef.current = null;
    setPendingImport(null);
    setPhase('loading');
    setDialogState((prev) => ({
      ...prev,
      errorMessage: null,
      loadSummary: null,
      isLoadSummaryOpen: false,
    }));
    loadingIdRef.current = show('JSONを読み込み中…');
    importOperationIdRef.current += 1;
    return {
      baselineRevision,
      operationId: importOperationIdRef.current,
    };
  }, [cancelImportProgress, show]);

  const applySnapshot = useCallback(
    async (
      filePath: string,
      baselineRevision: number | null,
      operationId: number,
    ) => {
      setDialogState((prev) => ({ ...prev, isLoading: true }));

      try {
        const result = await loadConditionJson({ mode: 'path', filePath });
        if (
          !importActiveRef.current ||
          importOperationIdRef.current !== operationId
        ) {
          return;
        }

        if (!result.ok) {
          cancelImportProgress(
            result.cancelled
              ? undefined
              : result.error || '読み込みに失敗しました。',
          );
          return;
        }

        const meta = resolveLoadedConditionJsonImportMeta(result.json);

        // creationType 不一致はエラー
        if (meta.creationType !== creationType) {
          cancelImportProgress(
            `このJSONは ${meta.creationType === 'workbook' ? '問題集作成' : '模擬試験作成'} モード用です。`,
          );
          return;
        }

        if (loadingIdRef.current) {
          setMessage(loadingIdRef.current, '問題データを読み込み中…');
        }
        const importMaps = await ensureCreatePdfImportTestDataMaps({
          creationType: meta.creationType,
          grade: meta.gradeId,
        });
        if (
          !importActiveRef.current ||
          importOperationIdRef.current !== operationId
        ) {
          return;
        }
        const { testCategory } = useCreatePdfResourceStore.getState();
        const resolved = await resolveLoadedConditionJson(result.json, {
          testDataByNo: importMaps.byNo,
          testCategory,
          loadLegacyCategorySnapshot: loadCreatePdfLegacyCategorySnapshot,
        });
        if (
          !importActiveRef.current ||
          importOperationIdRef.current !== operationId
        ) {
          return;
        }

        const { snapshot, adjustedRows } = resolveConditionJsonToSnapshot(
          resolved.json,
          importMaps.byNo,
          importMaps.byUuid,
        );

        // ストアへ反映
        useCreatePdfViewStore.setState({
          ...snapshot.common,
          creationType: resolved.json.creationType,
          currentPreviewState: null,
          isDirtyConditions: false,
        });
        useTestTableStore.setState(
          snapshot.testTable ??
            createInitialTableState(
              resolveConditionJsonShowQaaChoiceIndex(resolved.json),
            ),
        );
        if (resolved.json.creationType === 'workbook') {
          useWorkbookDraftStore.setState(
            snapshot.workbook ?? createInitialWorkbookState(),
          );
        } else {
          useExamDraftStore.setState(snapshot.exam ?? createInitialExamState());
        }

        const nextPendingImport = {
          baselineRevision,
          summary: createLoadConditionJsonResultSummary(
            resolved.importSummary,
            adjustedRows,
          ),
        };
        pendingImportRef.current = nextPendingImport;
        setPendingImport(nextPendingImport);
        setPhase('waiting-preview');
        setDialogState((prev) => ({ ...prev, isLoading: false }));
        if (loadingIdRef.current) {
          setMessage(loadingIdRef.current, 'PDFプレビューを描画中…');
        }
        useCreatePdfPreviewUpdateControllerStore
          .getState()
          .actions.markJsonApplyCompleted();
      } catch (error) {
        cancelImportProgress(
          error instanceof Error
            ? error.message
            : '予期しないエラーが発生しました。',
        );
      }
    },
    [cancelImportProgress, creationType, setMessage],
  );

  const handleLoad = useCallback(() => {
    const hasUnappliedDrawConditions =
      getHasUnappliedDrawConditions(creationType);

    const proceed = async () => {
      // まずファイル選択ダイアログを開く
      setDialogState((prev) => ({ ...prev, isLoading: true }));

      try {
        const selectResult = await loadConditionJson({ mode: 'dialog' });
        setDialogState((prev) => ({ ...prev, isLoading: false }));

        if (!selectResult.ok) {
          if (!selectResult.cancelled) {
            setDialogState((prev) => ({
              ...prev,
              errorMessage: selectResult.error || '読み込みに失敗しました。',
            }));
          }
          return;
        }

        const meta = resolveLoadedConditionJsonImportMeta(selectResult.json);

        // creationType 不一致 → モード切替確認ダイアログへ
        if (meta.creationType !== creationType) {
          pendingModeChangeFilePathRef.current = selectResult.filePath;
          setDialogState((prev) => ({
            ...prev,
            isModeChangeConfirmOpen: true,
          }));
          return;
        }

        const { baselineRevision, operationId } = beginImportProgress();
        await applySnapshot(
          selectResult.filePath,
          baselineRevision,
          operationId,
        );
      } catch (error) {
        setDialogState((prev) => ({
          ...prev,
          isLoading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : '予期しないエラーが発生しました。',
        }));
      }
    };

    if (hasUnappliedDrawConditions) {
      pendingActionRef.current = proceed;
      setDialogState((prev) => ({ ...prev, isDirtyConfirmOpen: true }));
    } else {
      void proceed();
    }
  }, [applySnapshot, beginImportProgress, creationType]);

  useEffect(() => {
    if (phase !== 'waiting-preview' || pendingImport === null) return;

    if (!isJsonLoading && lastCommitError) {
      cancelImportProgress(
        `PDFプレビューの更新に失敗しました。${lastCommitError}`,
      );
      return;
    }

    const isPreviewCompleted = isCreatePdfJsonImportPreviewCompleted({
      baselineRevision: pendingImport.baselineRevision,
      isCommitting,
      isJsonLoading,
      lastMeta,
      previewWindowStatus,
    });
    const isPreviewWaitSkippable = isCreatePdfJsonImportPreviewWaitSkippable({
      baselineRevision: pendingImport.baselineRevision,
      isCommitting,
      isJsonLoading,
      lastMeta,
      previewWindowStatus,
    });

    if (!isPreviewCompleted && !isPreviewWaitSkippable) {
      return;
    }

    hideImportLoading();
    importActiveRef.current = false;
    pendingImportRef.current = null;
    setPendingImport(null);
    setPhase('idle');
    setDialogState((prev) => ({
      ...prev,
      isLoading: false,
      errorMessage: null,
      isDirtyConfirmOpen: false,
      isModeChangeConfirmOpen: false,
      loadSummary: pendingImport.summary,
      isLoadSummaryOpen: true,
    }));
  }, [
    cancelImportProgress,
    hideImportLoading,
    isCommitting,
    isJsonLoading,
    lastCommitError,
    lastMeta,
    pendingImport,
    phase,
    previewWindowStatus,
  ]);

  useEffect(() => {
    return onCreatePdfPreviewWindowClosed(() => {
      if (!importActiveRef.current || pendingImportRef.current === null) return;
      cancelImportProgress('PDFプレビューウィンドウが閉じられました。');
    });
  }, [cancelImportProgress]);

  useEffect(() => {
    return () => {
      if (importActiveRef.current) {
        useCreatePdfPreviewUpdateControllerStore
          .getState()
          .actions.cancelJsonLoading();
      }
      importOperationIdRef.current += 1;
      importActiveRef.current = false;
      pendingImportRef.current = null;
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
    };
  }, [hide]);

  const confirmProceed = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDialogState((prev) => ({ ...prev, isDirtyConfirmOpen: false }));
    if (action) void action();
  }, []);

  const cancelProceed = useCallback(() => {
    pendingActionRef.current = null;
    setDialogState((prev) => ({ ...prev, isDirtyConfirmOpen: false }));
  }, []);

  const confirmModeChange = useCallback(() => {
    const filePath = pendingModeChangeFilePathRef.current;
    pendingModeChangeFilePathRef.current = null;
    setDialogState((prev) => ({ ...prev, isModeChangeConfirmOpen: false }));
    if (!filePath) return;
    const targetPath =
      creationType === 'workbook' ? '/createPdf/exam' : '/createPdf/workbook';
    void transitionCreatePdfMode({
      targetPath,
      state: { pendingJsonFilePath: filePath },
    });
  }, [creationType, transitionCreatePdfMode]);

  const cancelModeChange = useCallback(() => {
    pendingModeChangeFilePathRef.current = null;
    setDialogState((prev) => ({ ...prev, isModeChangeConfirmOpen: false }));
  }, []);

  const closeError = useCallback(() => {
    setDialogState((prev) => ({ ...prev, errorMessage: null }));
  }, []);

  const closeLoadSummary = useCallback(() => {
    // 閉じるアニメーション中も本文を保持し、空の同一ダイアログがちらつくのを防ぐ。
    setDialogState((prev) => ({ ...prev, isLoadSummaryOpen: false }));
  }, []);

  return {
    dialogState,
    handleLoad,
    confirmProceed,
    cancelProceed,
    closeError,
    closeLoadSummary,
    confirmModeChange,
    cancelModeChange,
  };
};

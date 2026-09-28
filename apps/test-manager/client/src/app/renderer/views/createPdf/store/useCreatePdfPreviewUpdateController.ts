import type { CreatePdfPreviewCacheMeta } from '@shared/types/pdfPreview';
import { deriveCreatePdfTestTableChecksCached } from '@views/createPdf/api/createPdfDerivedInputs';
import {
  buildActivePreviewCommitGuardReasons,
  buildExamPreviewCommitKey,
  buildWorkbookPreviewCommitKey,
  type PreviewCommitGuardReason,
} from '@views/createPdf/api/createPdfPreviewCommitKey';
import { getBlockingTestTableReasons } from '@views/createPdf/api/createPdfTestTableChecks';
import useCreatePdfPreviewCommit from '@views/createPdf/hooks/useCreatePdfPreviewCommit';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type {
  CreatePdfPreviewUpdateAdapter,
  CreatePdfPreviewUpdateStatus,
} from '@views/createPdf/types/previewUpdate';
import {
  type CreatePdfPreviewIssue,
  type CreatePdfRouteMode,
  isWorkbookRouteMode,
} from '@views/createPdf/types/viewState';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

type PreviewCommitResult =
  | { ok: true; meta: CreatePdfPreviewCacheMeta }
  | { ok: false; error: string };

type PreviewCommit = () => Promise<PreviewCommitResult>;

type SyncCommitStatePayload = {
  commit: PreviewCommit;
  commitKey: string | null;
  isCommitting: boolean;
  isLoadingTestData: boolean;
  isLoadingImageMeta: boolean;
  hasBlockingTestTableError: boolean;
};

type SyncDisplayStatePayload = {
  issues: CreatePdfPreviewIssue[];
  lastMeta: CreatePdfPreviewCacheMeta | null;
};

type CreatePdfPreviewUpdateControllerActions = {
  /** auto commit トリガーに関係する値を同期する */
  syncCommitState: (payload: SyncCommitStatePayload) => Promise<void>;
  /** 表示用の値のみを同期する（auto commit をトリガーしない） */
  syncDisplayState: (payload: SyncDisplayStatePayload) => void;
  requestManualCommit: () => Promise<void>;
  setGradeChangeDialogOpen: (value: boolean) => void;
  beginGuardedEdit: (editKey: string) => void;
  endGuardedEdit: (editKey: string) => void;
  beginJsonLoading: () => void;
  markJsonApplyCompleted: () => void;
  cancelJsonLoading: () => void;
  reset: () => void;
};

type CreatePdfPreviewUpdateControllerStore = CreatePdfPreviewUpdateStatus & {
  commit: PreviewCommit | null;
  commitKey: string | null;
  externalIsCommitting: boolean;
  // commit hook の state 反映前に二重実行しないための局所フラグ。
  isCommitRunning: boolean;
  isLoadingImageMeta: boolean;
  isGradeChangeDialogOpen: boolean;
  isJsonLoading: boolean;
  isJsonApplyCompleted: boolean;
  jsonApplyVersion: number;
  isResetPending: boolean;
  editingKeys: string[];
  hasBlockingTestTableError: boolean;
  lastTriggeredCommitKey: string | null;
  lastCommitError: string | null;
  actions: CreatePdfPreviewUpdateControllerActions;
};

const EMPTY_PREVIEW_ISSUES: CreatePdfPreviewIssue[] = [];

const buildGuardReasons = (state: {
  editingKeys: string[];
  isGradeChangeDialogOpen: boolean;
  isJsonLoading: boolean;
  isLoadingTestData: boolean;
  isResetPending: boolean;
  hasBlockingTestTableError: boolean;
}): PreviewCommitGuardReason[] =>
  buildActivePreviewCommitGuardReasons({
    isLoadingTestData: state.isLoadingTestData,
    isGradeChangeDialogOpen: state.isGradeChangeDialogOpen,
    isJsonLoading: state.isJsonLoading,
    isResetPending: state.isResetPending,
    isTableEditing: state.editingKeys.length > 0,
    hasBlockingTestTableError: state.hasBlockingTestTableError,
  });

const createInitialCreatePdfPreviewUpdateControllerState = (): Omit<
  CreatePdfPreviewUpdateControllerStore,
  'actions'
> => ({
  commit: null,
  commitKey: null,
  hasCommitKey: false,
  lastMeta: null,
  issues: [],
  externalIsCommitting: false,
  isCommitRunning: false,
  isCommitting: false,
  isLoadingTestData: false,
  isLoadingImageMeta: false,
  activeGuardReasons: [],
  isGradeChangeDialogOpen: false,
  isJsonLoading: false,
  isJsonApplyCompleted: false,
  jsonApplyVersion: 0,
  isResetPending: false,
  editingKeys: [],
  hasBlockingTestTableError: false,
  lastTriggeredCommitKey: null,
  lastCommitError: null,
});

const applyDerivedState = (
  state: Omit<CreatePdfPreviewUpdateControllerStore, 'actions'>,
): Omit<CreatePdfPreviewUpdateControllerStore, 'actions'> => {
  const nextGuardReasons = buildGuardReasons(state);
  // DEBUG: activeGuardReasons の参照変化を追跡（同内容でも毎回新配列になっていると useShallow が再レンダリングをトリガーし続ける）
  const prevGuardReasons = state.activeGuardReasons;
  const isSameContent =
    prevGuardReasons.length === nextGuardReasons.length &&
    prevGuardReasons.every((r, i) => r.id === nextGuardReasons[i].id);
  if (isSameContent) {
    return {
      ...state,
      isCommitting: state.externalIsCommitting || state.isCommitRunning, // ← 追加が必要
      activeGuardReasons: prevGuardReasons,
      hasCommitKey: state.commitKey !== null,
    };
  }

  return {
    ...state,
    isCommitting: state.externalIsCommitting || state.isCommitRunning,
    activeGuardReasons: nextGuardReasons,
    hasCommitKey: state.commitKey !== null,
  };
};

export const useCreatePdfPreviewUpdateControllerStore =
  create<CreatePdfPreviewUpdateControllerStore>((set, get) => {
    const setStateWithDerived = (
      updater:
        | Partial<Omit<CreatePdfPreviewUpdateControllerStore, 'actions'>>
        | ((
            state: Omit<CreatePdfPreviewUpdateControllerStore, 'actions'>,
          ) => Partial<Omit<CreatePdfPreviewUpdateControllerStore, 'actions'>>),
    ) => {
      set((currentState) => {
        const baseState = {
          commit: currentState.commit,
          commitKey: currentState.commitKey,
          hasCommitKey: currentState.hasCommitKey,
          lastMeta: currentState.lastMeta,
          issues: currentState.issues,
          externalIsCommitting: currentState.externalIsCommitting,
          isCommitRunning: currentState.isCommitRunning,
          isCommitting: currentState.isCommitting,
          isLoadingTestData: currentState.isLoadingTestData,
          isLoadingImageMeta: currentState.isLoadingImageMeta,
          activeGuardReasons: currentState.activeGuardReasons,
          isGradeChangeDialogOpen: currentState.isGradeChangeDialogOpen,
          isJsonLoading: currentState.isJsonLoading,
          isJsonApplyCompleted: currentState.isJsonApplyCompleted,
          jsonApplyVersion: currentState.jsonApplyVersion,
          isResetPending: currentState.isResetPending,
          editingKeys: currentState.editingKeys,
          hasBlockingTestTableError: currentState.hasBlockingTestTableError,
          lastTriggeredCommitKey: currentState.lastTriggeredCommitKey,
          lastCommitError: currentState.lastCommitError,
        } satisfies Omit<CreatePdfPreviewUpdateControllerStore, 'actions'>;

        const patch =
          typeof updater === 'function' ? updater(baseState) : updater;

        return applyDerivedState({
          ...baseState,
          ...patch,
        });
      });
    };

    const maybeAutoCommit = async () => {
      const state = get();
      if (!state.commitKey || !state.commit) {
        console.log('[DEBUG:autoCommit] skip: no commitKey or commit');
        return;
      }
      if (state.activeGuardReasons.length > 0) {
        console.log(
          '[DEBUG:autoCommit] skip: guardReasons',
          state.activeGuardReasons,
        );
        return;
      }
      if (state.isCommitting) {
        console.log('[DEBUG:autoCommit] skip: isCommitting');
        return;
      }
      if (state.commitKey === state.lastTriggeredCommitKey) {
        console.log('[DEBUG:autoCommit] skip: same commitKey', {
          length: state.commitKey.length,
        });
        return;
      }

      console.log('[DEBUG:autoCommit] execute', {
        commitKey: state.commitKey,
        lastTriggered: state.lastTriggeredCommitKey,
      });
      const targetCommitKey = state.commitKey;
      setStateWithDerived({
        isCommitRunning: true,
        lastTriggeredCommitKey: targetCommitKey,
        lastCommitError: null,
      });

      try {
        const result = await state.commit();
        if (!result.ok) {
          setStateWithDerived({ lastCommitError: result.error });
          console.error('[createPdf:previewUpdateStore] auto commit failed', {
            error: result.error,
          });
        }
      } finally {
        setStateWithDerived({ isCommitRunning: false });
      }
    };

    return {
      ...createInitialCreatePdfPreviewUpdateControllerState(),
      actions: {
        syncCommitState: async (payload) => {
          const state = get();
          const shouldReleaseJsonGuard =
            state.isJsonLoading && state.isJsonApplyCompleted;
          const isSame =
            state.commit === payload.commit &&
            state.commitKey === payload.commitKey &&
            state.externalIsCommitting === payload.isCommitting &&
            state.isLoadingTestData === payload.isLoadingTestData &&
            state.isLoadingImageMeta === payload.isLoadingImageMeta &&
            state.hasBlockingTestTableError ===
              payload.hasBlockingTestTableError;

          if (isSame && !shouldReleaseJsonGuard) return;
          setStateWithDerived({
            commit: payload.commit,
            commitKey: payload.commitKey,
            externalIsCommitting: payload.isCommitting,
            isLoadingTestData: payload.isLoadingTestData,
            isLoadingImageMeta: payload.isLoadingImageMeta,
            hasBlockingTestTableError: payload.hasBlockingTestTableError,
            ...(shouldReleaseJsonGuard
              ? {
                  isJsonLoading: false,
                  isJsonApplyCompleted: false,
                  // 同一内容の再インポートでも新しい revision を発行する。
                  lastTriggeredCommitKey: null,
                }
              : {}),
          });
          await maybeAutoCommit();
        },
        syncDisplayState: (payload) => {
          setStateWithDerived({
            issues: payload.issues,
            lastMeta: payload.lastMeta,
          });
        },
        requestManualCommit: async () => {
          const state = get();
          if (!state.commitKey || !state.commit) return;
          if (state.activeGuardReasons.length > 0 || state.isCommitting) return;

          const targetCommitKey = state.commitKey;
          setStateWithDerived({
            isCommitRunning: true,
            lastTriggeredCommitKey: targetCommitKey,
            lastCommitError: null,
          });

          try {
            const result = await state.commit();
            if (!result.ok) {
              setStateWithDerived({ lastCommitError: result.error });
              console.error(
                '[createPdf:previewUpdateStore] manual commit failed',
                {
                  error: result.error,
                },
              );
            }
          } finally {
            setStateWithDerived({ isCommitRunning: false });
            await maybeAutoCommit();
          }
        },
        setGradeChangeDialogOpen: (value) => {
          setStateWithDerived({ isGradeChangeDialogOpen: value });
          void maybeAutoCommit();
        },
        beginGuardedEdit: (editKey) => {
          setStateWithDerived((state) => ({
            editingKeys: state.editingKeys.includes(editKey)
              ? state.editingKeys
              : [...state.editingKeys, editKey],
          }));
        },
        endGuardedEdit: (editKey) => {
          setStateWithDerived((state) => ({
            editingKeys: state.editingKeys.filter((key) => key !== editKey),
          }));
          void maybeAutoCommit();
        },
        beginJsonLoading: () => {
          setStateWithDerived({
            isJsonLoading: true,
            isJsonApplyCompleted: false,
            lastCommitError: null,
          });
        },
        markJsonApplyCompleted: () => {
          setStateWithDerived((state) => ({
            isJsonApplyCompleted: true,
            jsonApplyVersion: state.jsonApplyVersion + 1,
          }));
        },
        cancelJsonLoading: () => {
          setStateWithDerived({
            isJsonLoading: false,
            isJsonApplyCompleted: false,
          });
        },
        reset: () => {
          set(createInitialCreatePdfPreviewUpdateControllerState());
        },
      },
    };
  });

const useCreatePdfPreviewUpdateController = (
  routeMode: CreatePdfRouteMode,
): CreatePdfPreviewUpdateAdapter => {
  const {
    commit,
    lastMeta,
    isCommitting,
    isLoadingTestData,
    isLoadingImageMeta = false,
  } = useCreatePdfPreviewCommit();
  const currentPreviewState = useCreatePdfViewStore(
    (state) => state.currentPreviewState,
  );
  const syncCommitState = useCreatePdfPreviewUpdateControllerStore(
    (state) => state.actions.syncCommitState,
  );
  const syncDisplayState = useCreatePdfPreviewUpdateControllerStore(
    (state) => state.actions.syncDisplayState,
  );
  const jsonApplyVersion = useCreatePdfPreviewUpdateControllerStore(
    (state) => state.jsonApplyVersion,
  );

  // commitKey に必要なフィールドのみを購読する。stepThree は表紙に出る examDate だけ対象。
  const { examBasic, examStepTwo, examDate } = useExamDraftStore(
    useShallow((state) => ({
      examBasic: state.basic,
      examStepTwo: state.stepTwo,
      examDate: state.stepThree.examDate,
    })),
  );
  const { workbookBasic, workbookStepTwo } = useWorkbookDraftStore(
    useShallow((state) => ({
      workbookBasic: state.basic,
      workbookStepTwo: state.stepTwo,
    })),
  );
  const tableSections = useTestTableStore((s) => s.sections);
  // TestData の変化を commitKey に反映させるためのバージョンカウンター
  const mapsVersion = useCreatePdfResourceStore((s) => s.testData.mapsVersion);
  // hasBlockingTestTableError を commitKey と同一レンダーで導出するための追加 selector
  const sectionMode = useTestTableStore((s) => s.sectionMode);
  const showQaaChoiceIndex = useTestTableStore(
    (s) => s.settings.showQaaChoiceIndex,
  );
  const testDataByNo = useCreatePdfResourceStore((s) => s.testData.maps.byNo);

  const commitKey = useMemo(() => {
    if (isWorkbookRouteMode(routeMode)) {
      return buildWorkbookPreviewCommitKey({
        title: workbookBasic.title,
        workbookMode: workbookStepTwo.workbookMode,
        isShuffleChoices: workbookStepTwo.options.isShuffleChoices,
        shuffleSeed: workbookStepTwo.options.shuffleSeed,
        sections: tableSections,
        mapsVersion,
      });
    }
    return buildExamPreviewCommitKey({
      title: examBasic.title,
      isShuffleChoices: examStepTwo.options.isShuffleChoices,
      shuffleSeed: examStepTwo.options.shuffleSeed,
      examDate,
      sections: tableSections,
      mapsVersion,
    });
  }, [
    examBasic.title,
    examDate,
    examStepTwo.options,
    tableSections,
    routeMode,
    workbookBasic.title,
    workbookStepTwo.workbookMode,
    workbookStepTwo.options,
    mapsVersion,
  ]);

  // commitKey と同じ sections/testDataByNo 参照を使うため、status 側のキャッシュ
  // （deriveCreatePdfTestTableChecksCached）にヒットし再計算コストはかからない。
  const grade = isWorkbookRouteMode(routeMode)
    ? workbookBasic.grade
    : examBasic.grade;
  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections: tableSections,
        testDataByNo,
        showQaaChoiceIndex,
        grade,
        sectionMode,
      }),
    [tableSections, testDataByNo, showQaaChoiceIndex, grade, sectionMode],
  );
  const hasBlockingTestTableError = useMemo(
    () => getBlockingTestTableReasons(testTableChecks).length > 0,
    [testTableChecks],
  );

  const issues = currentPreviewState?.issues ?? EMPTY_PREVIEW_ISSUES;

  // プレビュー更新に関係する state をリセットするための effect
  useEffect(() => {
    useCreatePdfPreviewUpdateControllerStore.getState().actions.reset();

    return () => {
      useCreatePdfPreviewUpdateControllerStore.getState().actions.reset();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: commkitKeyやガードの変化時に自動コミットを試みる
  useEffect(() => {
    void syncCommitState({
      commit,
      commitKey,
      isCommitting,
      isLoadingTestData,
      isLoadingImageMeta,
      hasBlockingTestTableError,
    });
  }, [
    commitKey,
    isCommitting,
    isLoadingTestData,
    isLoadingImageMeta,
    jsonApplyVersion,
    hasBlockingTestTableError,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: issues や lastMeta の変化時に表示状態を同期する
  useEffect(() => {
    syncDisplayState({ issues, lastMeta });
  }, [issues, lastMeta]);

  return useCreatePdfPreviewUpdateControllerStore(
    useShallow((state) => ({
      isCommitting: state.isCommitting,
      isLoadingTestData: state.isLoadingTestData,
      hasCommitKey: state.hasCommitKey,
      lastMeta: state.lastMeta,
      activeGuardReasons: state.activeGuardReasons,
      issues: state.issues,
      requestManualCommit: state.actions.requestManualCommit,
      setGradeChangeDialogOpen: state.actions.setGradeChangeDialogOpen,
      beginGuardedEdit: state.actions.beginGuardedEdit,
      endGuardedEdit: state.actions.endGuardedEdit,
    })),
  );
};

export default useCreatePdfPreviewUpdateController;

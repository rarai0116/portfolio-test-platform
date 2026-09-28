import 'dockview-react/dist/styles/dockview.css';
import BasicDialog from '@parts/basicDialog';
import {
  getCreatePdfPreviewWindowStatus,
  loadConditionJson,
  onCreatePdfPreviewUpdateRequested,
  openCreatePdfPreviewWindow,
} from '@renderer/api/createPdfExportBridge';
import {
  commitCreatePdfPreviewDocument,
  readCreatePdfPreviewDocument,
} from '@renderer/api/pdfPreviewBridge';
import type {
  CreatePdfConditionJson,
  ExamConditionJson,
  WorkbookConditionJson,
} from '@shared/types/createPdfConditionJson';
import { buildSlotKey } from '@shared/types/pdfPreview';
import {
  type AdjustedRowInfo,
  buildExamConditionJson,
  buildWorkbookConditionJson,
  resolveConditionJsonToSnapshot,
  shouldShowQaaChoiceIndexForWorkbookMode,
} from '@views/createPdf/api/conditionJsonConverter';
import {
  type ConditionJsonImportSummary,
  resolveLoadedConditionJson,
  resolveLoadedConditionJsonImportMeta,
} from '@views/createPdf/api/conditionJsonImportResolver';
import {
  createInitialExamState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import {
  resolveCreatePdfInitialLoad,
  resolveCreatePdfModeFromPathname,
} from '@views/createPdf/api/routeModeState';
import useCreatePdfDockviewPanelManager from '@views/createPdf/hooks/useCreatePdfDockviewPanelManager';
import { useCreatePdfInitialGlobalLoading } from '@views/createPdf/hooks/useCreatePdfInitialGlobalLoading';
import { useCreatePdfStatusController } from '@views/createPdf/hooks/useCreatePdfStatusController';
import {
  createLoadConditionJsonResultSummary,
  ensureCreatePdfImportTestDataMaps,
  type LoadConditionJsonResultSummary,
  loadCreatePdfLegacyCategorySnapshot,
} from '@views/createPdf/hooks/useLoadConditionJson';
import useSyncCreatePdfTestData from '@views/createPdf/hooks/useSyncCreatePdfTestData';
import { createPdfModeTransitionStore } from '@views/createPdf/store/createPdfModeTransitionStore';
import {
  createPdfPreviewOrderStore,
  type PreviewOrderSnapshot,
} from '@views/createPdf/store/createPdfPreviewOrderStore';
import useCreatePdfDockviewStore from '@views/createPdf/store/useCreatePdfDockviewStore';
import { useCreatePdfPreviewUpdateControllerStore } from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import ExamPanel from '@views/createPdf/templates/examPanel';
import TempExamPanel from '@views/createPdf/templates/tempExamPanel';
import TempWorkbookPanel from '@views/createPdf/templates/tempWorkbookPanel';
import TestTablePanel from '@views/createPdf/templates/testTablePanel';
import WorkBookPanel from '@views/createPdf/templates/workbookPanel';
import { createPdfPanel } from '@views/createPdf/types/dockviewType';
import type {
  CreatePdfRouteMode,
  CreatePdfRouteSnapshot,
} from '@views/createPdf/types/viewState';
import { isWorkbookRouteMode } from '@views/createPdf/types/viewState';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import {
  DockviewDefaultTab,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  themeLightSpaced,
} from 'dockview-react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const NonClosableTab = (props: IDockviewPanelHeaderProps) => (
  <DockviewDefaultTab hideClose={true} {...props} />
);

export const resolveRestoreSlotKey = (
  slots: Record<string, { restoreState: CreatePdfConditionJson | null }>,
  lastActiveSlotKey: string | undefined,
  fallbackSlotKey: string,
): string => {
  if (
    lastActiveSlotKey &&
    slots[lastActiveSlotKey]?.restoreState !== null &&
    slots[lastActiveSlotKey]?.restoreState !== undefined
  ) {
    return lastActiveSlotKey;
  }
  return fallbackSlotKey;
};

/** routeMode の初期スナップショットを Zustand store へ即時適用する */
export function applyInitialSnapshot(
  routeMode: CreatePdfRouteMode,
  jsonSnapshot: CreatePdfRouteSnapshot | null,
  applySnapshotFn: (
    mode: CreatePdfRouteMode,
    snapshot: CreatePdfRouteSnapshot,
  ) => void,
): void {
  const loadResult = resolveCreatePdfInitialLoad({
    mode: routeMode,
    jsonSnapshot,
    savedSnapshot: null,
  });
  applySnapshotFn(routeMode, loadResult.snapshot);
}

/** ドラフト状態をファイルへ fire-and-forget 保存する */
export function saveDraftToFile(
  mode: CreatePdfRouteMode | null,
  pendingRestoreStateRef: RefObject<CreatePdfConditionJson | null>,
  hasRestoredRef: RefObject<boolean>,
): void {
  if (!mode) return;
  if (!hasRestoredRef.current) {
    console.log('[T29:save] skip: restore not yet determined', { mode });
    return;
  }
  console.log('[T29:save] committing', { mode });
  const testDataByNo = useCreatePdfResourceStore.getState().testData.maps.byNo;
  const now = new Date().toISOString();
  if (isWorkbookRouteMode(mode)) {
    const workbookDraft = useWorkbookDraftStore.getState();
    const testTableState = useTestTableStore.getState();
    const condJson =
      (pendingRestoreStateRef.current as WorkbookConditionJson | null) ??
      buildWorkbookConditionJson(workbookDraft, testTableState, testDataByNo);
    const scope = {
      grade: workbookDraft.basic.grade,
      workbookMode: workbookDraft.stepTwo.workbookMode,
    } as const;
    const slotKey = buildSlotKey(scope) as string;
    void commitCreatePdfPreviewDocument({
      creationType: 'workbook',
      slotKey,
      document: {
        schemaVersion: 1,
        creationType: 'workbook',
        revision: 0,
        updatedAt: now,
        slots: {
          [slotKey]: {
            scope,
            restoreState: condJson,
            previewSnapshot: null,
            updatedAt: now,
          },
        },
      },
    });
  } else {
    const examDraft = useExamDraftStore.getState();
    const testTableState = useTestTableStore.getState();
    const condJson =
      (pendingRestoreStateRef.current as ExamConditionJson | null) ??
      buildExamConditionJson(examDraft, testTableState, testDataByNo);
    const scope = { grade: examDraft.basic.grade, workbookMode: null } as const;
    const slotKey = buildSlotKey(scope);
    void commitCreatePdfPreviewDocument({
      creationType: 'exam',
      slotKey,
      document: {
        schemaVersion: 1,
        creationType: 'exam',
        revision: 0,
        updatedAt: now,
        slots: {
          [slotKey]: {
            scope,
            restoreState: condJson,
            previewSnapshot: null,
            updatedAt: now,
          },
        },
      },
    });
  }
}

// ---- RestoreFlow / JsonFileLoad オプション型 ----

type RestoreFlowOptions = {
  pendingRestoreStateRef: RefObject<CreatePdfConditionJson | null>;
  hasRestoredRef: RefObject<boolean>;
  onApply: (
    snapshot: CreatePdfRouteSnapshot,
    adjustedRows: AdjustedRowInfo[],
  ) => void;
  onSkip: () => void;
};

type JsonFileLoadOptions = {
  onApply: (
    snapshot: CreatePdfRouteSnapshot,
    adjustedRows: AdjustedRowInfo[],
    importSummary: ConditionJsonImportSummary,
  ) => void;
  onSettled?: () => void;
};

type TransitionPreviewIntent = 'restore' | 'suppress' | null;

const CreatePdfView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeMode = resolveCreatePdfModeFromPathname(location.pathname);
  const workbookGrade = useWorkbookDraftStore((state) => state.basic.grade);
  const examDraftGrade = useExamDraftStore((state) => state.basic.grade);
  const setDockviewApi = useCreatePdfDockviewStore(
    (state) => state.actions.setDockviewApi,
  );
  const { defaultPanelOptions } = useCreatePdfDockviewPanelManager(routeMode);
  const previousModeRef = useRef<CreatePdfRouteMode | null>(null);
  const pendingJsonSnapshotRef = useRef<CreatePdfRouteSnapshot | null>(null);
  // T29: stale IPC キャンセル用（remount で新インスタンスになるが念のため維持）
  const restoreStateReadKeyRef = useRef(0);
  const pendingRestoreStateRef = useRef<CreatePdfConditionJson | null>(null);
  // T29: restore決定前の空データ上書きを防ぐフラグ
  const hasRestoredRef = useRef(false);
  const transitionPreviewIntentRef = useRef<TransitionPreviewIntent>(null);
  const transitionIdRef = useRef<string | null>(null);
  const activeGrade = isWorkbookRouteMode(routeMode)
    ? workbookGrade
    : examDraftGrade;

  type CreatePdfLocationState = { pendingJsonFilePath?: string };
  const pendingJsonFilePath =
    (location.state as CreatePdfLocationState | null)?.pendingJsonFilePath ??
    null;

  const [pendingLoadSummary, setPendingLoadSummary] =
    useState<LoadConditionJsonResultSummary | null>(null);
  const [isInitialStateSettled, setInitialStateSettled] = useState(false);

  useSyncCreatePdfTestData(activeGrade);
  useCreatePdfStatusController();
  useCreatePdfInitialGlobalLoading(routeMode, isInitialStateSettled);

  const applyRouteSnapshot = useCallback(
    (mode: CreatePdfRouteMode, snapshot: CreatePdfRouteSnapshot) => {
      const isWorkbookMode = isWorkbookRouteMode(mode);
      const fallbackWorkbookState = isWorkbookMode
        ? createInitialWorkbookState()
        : null;
      const initialShowQaaChoiceIndex = isWorkbookMode
        ? shouldShowQaaChoiceIndexForWorkbookMode(
            snapshot.workbook?.stepTwo.workbookMode ??
              fallbackWorkbookState?.stepTwo.workbookMode ??
              'multipleChoice',
          )
        : false;

      useCreatePdfViewStore.setState({
        ...snapshot.common,
        creationType: isWorkbookMode ? 'workbook' : 'exam',
        currentPreviewState: null,
      });

      const INITIAL_TABLE_STATE = {
        sections: [],
        sectionMode: 'single' as const,
        settings: { showQaaChoiceIndex: initialShowQaaChoiceIndex },
        lastAppliedDrawConditionKey: null,
        lastSavedOrRestoredTableKey: null,
      };
      useTestTableStore.setState(snapshot.testTable ?? INITIAL_TABLE_STATE);

      if (isWorkbookMode) {
        useWorkbookDraftStore.setState(
          snapshot.workbook ??
            fallbackWorkbookState ??
            createInitialWorkbookState(),
        );
        return;
      }

      useExamDraftStore.setState(snapshot.exam ?? createInitialExamState());
    },
    [],
  );

  const refreshPreviewWindowStatus = useCallback(async () => {
    const result = await getCreatePdfPreviewWindowStatus();
    if (!result.ok) return;

    useCreatePdfStatusRuntimeStore
      .getState()
      .actions.setPreviewWindowStatus(result.status);
  }, []);

  const openPreviewWindowAndRefreshStatus = useCallback(
    async (request: Parameters<typeof openCreatePdfPreviewWindow>[0]) => {
      await openCreatePdfPreviewWindow(request);
      await refreshPreviewWindowStatus();
    },
    [refreshPreviewWindowStatus],
  );

  const openPreviewForSessionScope = useCallback(
    (sessionScope: NonNullable<PreviewOrderSnapshot['sessionScope']>) => {
      const transitionPreviewIntent = transitionPreviewIntentRef.current;

      if (transitionPreviewIntent === 'suppress') {
        transitionPreviewIntentRef.current = null;
        transitionIdRef.current = null;
        return;
      }

      if (transitionPreviewIntent === 'restore') {
        const transitionId = transitionIdRef.current;
        transitionPreviewIntentRef.current = null;
        transitionIdRef.current = null;
        void (async () => {
          try {
            await openPreviewWindowAndRefreshStatus({
              creationType: sessionScope.creationType,
              slotKey: sessionScope.slotKey,
            });
          } finally {
            if (transitionId) {
              createPdfModeTransitionStore
                .getState()
                .actions.complete(transitionId);
            }
          }
        })();
        return;
      }

      void openPreviewWindowAndRefreshStatus({
        creationType: sessionScope.creationType,
        slotKey: sessionScope.slotKey,
      });
    },
    [openPreviewWindowAndRefreshStatus],
  );

  /** sessionId 変化でプレビューウィンドウを開く購読を開始する */
  const subscribePreviewSession = useCallback((): (() => void) => {
    let prevSessionId = createPdfPreviewOrderStore.getSnapshot().sessionId;
    const unsub = createPdfPreviewOrderStore.subscribe(() => {
      const { sessionScope, sessionId } =
        createPdfPreviewOrderStore.getSnapshot();
      if (sessionId === prevSessionId || !sessionScope) return;
      prevSessionId = sessionId;
      openPreviewForSessionScope(sessionScope);
    });
    // マウント時点で既に sessionScope がある場合も起動する
    const { sessionScope } = createPdfPreviewOrderStore.getSnapshot();
    if (sessionScope) {
      openPreviewForSessionScope(sessionScope);
    }
    return unsub;
  }, [openPreviewForSessionScope]);

  /** 前回ドラフトの IPC 読込 + testData 待機 → apply を開始する */
  const startRestoreFlow = useCallback(
    (mode: CreatePdfRouteMode, opts: RestoreFlowOptions): (() => void) => {
      let cancelled = false;

      restoreStateReadKeyRef.current += 1;
      const readKey = restoreStateReadKeyRef.current;
      opts.pendingRestoreStateRef.current = null;
      opts.hasRestoredRef.current = false;

      const creationType = isWorkbookRouteMode(mode) ? 'workbook' : 'exam';

      void (async () => {
        const result = await readCreatePdfPreviewDocument(creationType);
        if (cancelled || readKey !== restoreStateReadKeyRef.current) return;

        if (!result.ok) {
          opts.hasRestoredRef.current = true; // read失敗 → save可能
          opts.onSkip();
          return;
        }

        const grade = isWorkbookRouteMode(mode)
          ? useWorkbookDraftStore.getState().basic.grade
          : useExamDraftStore.getState().basic.grade;
        const workbookMode = isWorkbookRouteMode(mode)
          ? useWorkbookDraftStore.getState().stepTwo.workbookMode
          : null;
        const fallbackSlotKey = buildSlotKey({ grade, workbookMode });
        const slotKey = resolveRestoreSlotKey(
          result.document.slots,
          result.document.lastActiveSlotKey,
          fallbackSlotKey,
        );
        const restoreState =
          result.document.slots[slotKey]?.restoreState ?? null;

        if (restoreState === null) {
          opts.hasRestoredRef.current = true; // restoreなし確定 → save可能
          opts.onSkip();
          return;
        }

        opts.pendingRestoreStateRef.current = restoreState;

        const maps = await ensureCreatePdfImportTestDataMaps({
          creationType,
          grade: restoreState.gradeId,
        });
        if (cancelled) return;

        const { snapshot, adjustedRows } = resolveConditionJsonToSnapshot(
          restoreState,
          maps.byNo,
          maps.byUuid,
        );
        opts.onApply(snapshot, adjustedRows);
        opts.pendingRestoreStateRef.current = null;
      })();

      return () => {
        cancelled = true;
      };
    },
    [],
  );

  /** ナビゲーションで渡された JSON ファイルを読込んで状態を適用する */
  const startJsonFileLoad = useCallback(
    (filePath: string | null, opts: JsonFileLoadOptions): (() => void) => {
      if (!filePath) return () => {};

      let cancelled = false;

      const tryLoad = async () => {
        try {
          const result = await loadConditionJson({ mode: 'path', filePath });
          if (cancelled || !result.ok) return;
          const meta = resolveLoadedConditionJsonImportMeta(result.json);
          const importMaps = await ensureCreatePdfImportTestDataMaps({
            creationType: meta.creationType,
            grade: meta.gradeId,
          });
          if (cancelled) return;
          const { testCategory } = useCreatePdfResourceStore.getState();
          const resolved = await resolveLoadedConditionJson(result.json, {
            testDataByNo: importMaps.byNo,
            testCategory,
            loadLegacyCategorySnapshot: loadCreatePdfLegacyCategorySnapshot,
          });
          const { snapshot, adjustedRows } = resolveConditionJsonToSnapshot(
            resolved.json,
            importMaps.byNo,
            importMaps.byUuid,
          );
          if (cancelled) return;
          opts.onApply(snapshot, adjustedRows, resolved.importSummary);
        } finally {
          if (!cancelled) opts.onSettled?.();
        }
      };

      void tryLoad();

      return () => {
        cancelled = true;
      };
    },
    [],
  );

  // 単一 useEffect([]) で全ライフサイクルを管理する
  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント/アンマウント時のみ実行。依存は安定参照またはマウント時点の値を使用。
  useEffect(() => {
    setInitialStateSettled(false);
    const currentCreationType = isWorkbookRouteMode(routeMode)
      ? 'workbook'
      : 'exam';
    createPdfPreviewOrderStore.setActiveCreationType(currentCreationType);

    const transitionState = createPdfModeTransitionStore.getState();
    if (
      transitionState.isTransitioning &&
      transitionState.targetPath === location.pathname &&
      transitionState.transitionId
    ) {
      transitionIdRef.current = transitionState.transitionId;
      const shouldRestorePreviewWindow = createPdfModeTransitionStore
        .getState()
        .actions.consumeRestoreIntent();
      transitionPreviewIntentRef.current = shouldRestorePreviewWindow
        ? 'restore'
        : 'suppress';
      if (!shouldRestorePreviewWindow) {
        createPdfModeTransitionStore
          .getState()
          .actions.complete(transitionState.transitionId);
      }
    } else {
      transitionIdRef.current = null;
      transitionPreviewIntentRef.current = null;
    }

    // 同期初期化（初期スナップショットを即時適用）
    applyInitialSnapshot(
      routeMode,
      pendingJsonSnapshotRef.current,
      applyRouteSnapshot,
    );
    previousModeRef.current = routeMode;
    pendingJsonSnapshotRef.current = null;

    const unsubSession = subscribePreviewSession();
    const unsubPreviewUpdateRequest = onCreatePdfPreviewUpdateRequested(
      (request) => {
        const currentCreationType =
          useCreatePdfViewStore.getState().creationType;
        if (request.creationType !== currentCreationType) return;

        void useCreatePdfPreviewUpdateControllerStore
          .getState()
          .actions.requestManualCommit();
      },
    );

    let cancelRestore: () => void;
    if (pendingJsonFilePath) {
      // JSON 読込経路: 自動復元をスキップし save ガードを即解除
      hasRestoredRef.current = true;
      cancelRestore = () => {};
    } else {
      cancelRestore = startRestoreFlow(routeMode, {
        pendingRestoreStateRef,
        hasRestoredRef,
        onApply: (snapshot, _adjustedRows) => {
          applyRouteSnapshot(routeMode, snapshot);
          hasRestoredRef.current = true;
          setInitialStateSettled(true);
        },
        onSkip: () => {
          hasRestoredRef.current = true;
          setInitialStateSettled(true);
        },
      });
    }

    const cancelJsonLoad = startJsonFileLoad(pendingJsonFilePath, {
      onApply: (snapshot, adjustedRows, importSummary) => {
        applyRouteSnapshot(routeMode, snapshot);
        navigate(location.pathname, { replace: true, state: null });
        setPendingLoadSummary(
          createLoadConditionJsonResultSummary(importSummary, adjustedRows),
        );
      },
      onSettled: () => setInitialStateSettled(true),
    });

    return () => {
      unsubPreviewUpdateRequest();
      unsubSession();
      cancelRestore();
      cancelJsonLoad();
      saveDraftToFile(
        previousModeRef.current,
        pendingRestoreStateRef,
        hasRestoredRef,
      );
      const currentTransitionState = createPdfModeTransitionStore.getState();
      const isTransitionSource =
        currentTransitionState.isTransitioning &&
        currentTransitionState.sourcePath === location.pathname;
      const isTransitionTarget =
        currentTransitionState.isTransitioning &&
        currentTransitionState.targetPath === location.pathname;
      if (isTransitionTarget) {
        currentTransitionState.actions.reset();
      }
      if (!isTransitionSource) {
        createPdfPreviewOrderStore.setActiveCreationType(null);
      }
      useCreatePdfResourceStore.getState().actions.reset();
      setDockviewApi(null);
    };
  }, []);

  const components = useMemo(() => {
    return {
      [createPdfPanel.tempExam]: (_props: IDockviewPanelProps) => (
        <TempExamPanel />
      ),
      [createPdfPanel.tempWorkbook]: (_props: IDockviewPanelProps) => (
        <TempWorkbookPanel />
      ),
      [createPdfPanel.exam]: (_props: IDockviewPanelProps) => <ExamPanel />,
      [createPdfPanel.workbook]: (_props: IDockviewPanelProps) => (
        <WorkBookPanel />
      ),
      [createPdfPanel.testTable]: (_props: IDockviewPanelProps) => (
        <TestTablePanel />
      ),
    };
  }, []);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setDockviewApi(event.api);
      Object.values(defaultPanelOptions).forEach((option) => {
        event.api.addPanel(option);
      });
    },
    [defaultPanelOptions, setDockviewApi],
  );

  return (
    <>
      <div className="h-full w-full">
        <DockviewReact
          key={routeMode}
          components={components}
          onReady={onReady}
          defaultTabComponent={NonClosableTab} // ← 全パネルに適用
          singleTabMode="fullwidth"
          theme={themeLightSpaced}
        />
      </div>
      {/* 反対モードJSON読込後の読み込み結果ダイアログ */}
      <BasicDialog
        open={pendingLoadSummary !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLoadSummary(null);
        }}
        title="JSONを読み込みました"
        description={
          pendingLoadSummary
            ? [
                `読み込み形式: ${pendingLoadSummary.sourceType}`,
                `入力行数: ${pendingLoadSummary.inputRowCount}`,
                `復元行数: ${pendingLoadSummary.convertedRowCount}`,
                `失敗件数: ${pendingLoadSummary.failedRowCount}`,
                `自動調整件数: ${pendingLoadSummary.adjustedRowCount}`,
              ].join('\n')
            : ''
        }
        primaryButtonText="OK"
        onClickPrimaryButton={() => setPendingLoadSummary(null)}
      />
    </>
  );
};

export default CreatePdfView;

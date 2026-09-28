import {
  createInitialDifficultyState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import { deriveYearFilterOptions } from '@views/createPdf/api/createPdfDerivedInputs';
import { shouldShowQaaChoiceIndexForWorkbookMode } from '@views/createPdf/api/conditionJsonConverter';
import { getDefaultSelectedYears } from '@views/createPdf/hooks/useTestYears';
import { useOtherTagOptions } from '@views/createPdf/hooks/useOtherTagOptions';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type { TestSubject } from '@shared/types/contracts';
import type {
  WorkbookState,
  WorkbookStepTwoState,
} from '@views/createPdf/types/draftState';
import type {
  CreatePdfStepOneAdapter,
  CreatePdfStepThreeAdapter,
  CreatePdfWorkbookStepTwoAdapter,
  ResetPanelOptions,
  ResetPanelTarget,
} from '@views/createPdf/types/panelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import {
  DEFAULT_TEST_TABLE_SECTION_SUBJECT,
  type TestTableStoreSnapshot,
} from '@views/createPdf/types/testTable';
import { getCreatePdfPreviewHealth } from '@views/createPdf/types/viewState';
import type {
  WorkbookCategoryTableRow,
  WorkbookMode,
} from '@views/createPdf/types/viewState';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTestYears } from './useTestYears';
import useWorkbookStepTwo from './useWorkbookStepTwo';
type UseWorkbookPanelModelInput = {
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'setGradeChangeDialogOpen'
  >;
};

type WorkbookSubjectCache = {
  categoryTable: WorkbookCategoryTableRow[];
  testTable: TestTableStoreSnapshot;
};

const normalizeWorkbookTestTableForConditions = (
  snapshot: TestTableStoreSnapshot,
  categoryTable: readonly WorkbookCategoryTableRow[],
): TestTableStoreSnapshot => {
  const remainingByConditionId = new Map(
    categoryTable.map((row) => [row.id, Math.max(0, row.count)]),
  );

  const sections = snapshot.sections.map((section) => ({
    ...section,
    rows: section.rows.filter((row) => {
      if (row.sourceConditionId === null) return false;
      const remaining = remainingByConditionId.get(row.sourceConditionId);
      if (remaining === undefined || remaining <= 0) return false;
      remainingByConditionId.set(row.sourceConditionId, remaining - 1);
      return true;
    }),
  }));

  return {
    ...snapshot,
    sections,
  };
};

/**
 * workbook panel の唯一の入口となる panel model hook。
 * store selector の集約、Step1/2/3 の接続、grade 変更 command を担う。
 */
const useWorkbookPanelModel = (input?: UseWorkbookPanelModelInput) => {
  const {
    basic,
    stepTwo: stepTwoState,
    stepThree: stepThreeState,
    actions: storeActions,
  } = useWorkbookDraftStore(
    useShallow((state) => ({
      basic: state.basic,
      stepTwo: state.stepTwo,
      stepThree: state.stepThree,
      actions: state.actions,
    })),
  );

  const currentPreviewState = useCreatePdfViewStore(
    (s) => s.currentPreviewState,
  );
  const { testTableSections, lastSavedOrRestoredTableKey } = useTestTableStore(
    useShallow((s) => ({
      testTableSections: s.sections,
      lastSavedOrRestoredTableKey: s.lastSavedOrRestoredTableKey,
    })),
  );

  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<1 | 2 | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [workbookModeDialogOpen, setWorkbookModeDialogOpen] = useState(false);
  const [pendingWorkbookMode, setPendingWorkbookMode] =
    useState<WorkbookMode | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<TestSubject | null>(
    null,
  );
  const subjectCacheRef = useRef<Map<TestSubject, WorkbookSubjectCache>>(
    new Map(),
  );

  const handleSelectedYearsChange = useCallback(
    (value: string[] | null) => {
      const current = useWorkbookDraftStore.getState();
      storeActions.setSelectedYears(value);
      if (current.basic.selectedYears === null) return;
      if (!current.stepTwo.difficulty.isCalculated) return;
      storeActions.setDifficulty(createInitialDifficultyState());
    },
    [storeActions],
  );

  const yearFilter = useTestYears({
    selectedYears: basic.selectedYears,
    onSelectedYearsChange: handleSelectedYearsChange,
  });

  const stepTwoHook = useWorkbookStepTwo({
    selectedYearNos: yearFilter.selectedYearNos,
  });
  const { tagOptions } = useOtherTagOptions({ grade: basic.grade });

  const previewHealth = useMemo(
    () => getCreatePdfPreviewHealth(currentPreviewState),
    [currentPreviewState],
  );

  const hasUnsavedTableChanges = useMemo(() => {
    // exam 側と合わせて sections 全体の JSON で比較する
    const currentKey = JSON.stringify(testTableSections);
    return currentKey !== lastSavedOrRestoredTableKey;
  }, [testTableSections, lastSavedOrRestoredTableKey]);

  const tableRowCount = useMemo(
    () =>
      testTableSections.reduce((sum, section) => sum + section.rows.length, 0),
    [testTableSections],
  );

  const resolveDefaultSelectedYears = useCallback((): string[] | null => {
    const labels = deriveYearFilterOptions(
      useCreatePdfResourceStore.getState().testData.maps.byNo,
    ).sortedLabels;
    const defaultYears = getDefaultSelectedYears(labels);
    return defaultYears.length > 0 ? defaultYears : null;
  }, []);

  const resetPanel = useCallback(
    (targets: ResetPanelTarget[], options: ResetPanelOptions = {}) => {
      const targetSet = new Set(targets);
      const current = useWorkbookDraftStore.getState();
      const initial = createInitialWorkbookState();
      const nextGrade = options.grade ?? current.basic.grade;
      const nextSelectedYears =
        options.grade !== undefined && options.grade !== current.basic.grade
          ? null
          : resolveDefaultSelectedYears();

      const nextBasic: WorkbookState['basic'] = {
        ...current.basic,
        grade: nextGrade,
        ...(targetSet.has('title') ? { title: initial.basic.title } : {}),
        ...(targetSet.has('selectedYears')
          ? { selectedYears: nextSelectedYears }
          : {}),
      };

      const nextStepTwo: WorkbookStepTwoState = {
        ...current.stepTwo,
        ...(options.workbookMode !== undefined
          ? { workbookMode: options.workbookMode }
          : {}),
        ...(targetSet.has('options')
          ? { options: initial.stepTwo.options }
          : {}),
        ...(targetSet.has('difficulty')
          ? { difficulty: initial.stepTwo.difficulty }
          : {}),
        ...(targetSet.has('category')
          ? { categoryTable: initial.stepTwo.categoryTable }
          : {}),
      };

      storeActions.replaceDraft({
        basic: nextBasic,
        stepTwo: nextStepTwo,
        stepThree: targetSet.has('stepThree')
          ? initial.stepThree
          : current.stepThree,
      });

      if (targetSet.has('testTable')) {
        const testTableActions = useTestTableStore.getState().actions;
        testTableActions.reset();
        testTableActions.setSettings({
          showQaaChoiceIndex: shouldShowQaaChoiceIndexForWorkbookMode(
            nextStepTwo.workbookMode,
          ),
        });
      }
      if (targetSet.has('preview')) {
        useCreatePdfViewStore.getState().actions.setCurrentPreviewState(null);
      }
    },
    [resolveDefaultSelectedYears, storeActions],
  );

  const resetAll = useCallback(() => {
    subjectCacheRef.current.clear();
    setSelectedSubject(null);
    resetPanel([
      'title',
      'selectedYears',
      'options',
      'difficulty',
      'category',
      'testTable',
      'stepThree',
      'preview',
    ]);
  }, [resetPanel]);

  const applyWorkbookModeChange = useCallback(
    (nextMode: WorkbookMode) => {
      subjectCacheRef.current.clear();
      resetPanel(['difficulty', 'category', 'testTable', 'preview'], {
        workbookMode: nextMode,
      });
    },
    [resetPanel],
  );

  /**
   * 級変更のリクエストを処理する関数。これは、view層にあるべきなのでdeprecated予定
   */
  const requestGradeChange = useCallback(
    (nextGrade: 1 | 2) => {
      if (nextGrade === basic.grade) return;
      setPendingGrade(nextGrade);
      setGradeDialogOpen(true);
      input?.previewUpdate?.setGradeChangeDialogOpen(true);
    },
    [basic.grade, input?.previewUpdate],
  );

  const confirmGradeChange = useCallback(() => {
    if (pendingGrade == null) return;
    subjectCacheRef.current.clear();
    setSelectedSubject(null);
    resetPanel(
      ['selectedYears', 'difficulty', 'category', 'testTable', 'preview'],
      { grade: pendingGrade },
    );
    setPendingGrade(null);
    setGradeDialogOpen(false);
    input?.previewUpdate?.setGradeChangeDialogOpen(false);
  }, [input?.previewUpdate, pendingGrade, resetPanel]);

  const cancelGradeChange = useCallback(() => {
    setPendingGrade(null);
    setGradeDialogOpen(false);
    input?.previewUpdate?.setGradeChangeDialogOpen(false);
  }, [input?.previewUpdate]);

  const requestResetAll = useCallback(() => {
    setResetDialogOpen(true);
  }, []);

  const confirmResetAll = useCallback(() => {
    resetAll();
    setResetDialogOpen(false);
  }, [resetAll]);

  const cancelResetAll = useCallback(() => {
    setResetDialogOpen(false);
  }, []);

  const requestWorkbookModeChange = useCallback(
    (nextMode: WorkbookMode) => {
      if (nextMode === stepTwoState.workbookMode) return;
      if (tableRowCount > 0) {
        setPendingWorkbookMode(nextMode);
        setWorkbookModeDialogOpen(true);
        return;
      }
      applyWorkbookModeChange(nextMode);
    },
    [applyWorkbookModeChange, stepTwoState.workbookMode, tableRowCount],
  );

  const confirmWorkbookModeChange = useCallback(() => {
    if (pendingWorkbookMode === null) return;
    applyWorkbookModeChange(pendingWorkbookMode);
    setPendingWorkbookMode(null);
    setWorkbookModeDialogOpen(false);
  }, [applyWorkbookModeChange, pendingWorkbookMode]);

  const cancelWorkbookModeChange = useCallback(() => {
    setPendingWorkbookMode(null);
    setWorkbookModeDialogOpen(false);
  }, []);

  const effectiveSelectedSubject = useMemo<TestSubject | null>(() => {
    if (selectedSubject !== null) return selectedSubject;
    const conditionSubject = stepTwoState.categoryTable[0]?.subject;
    if (conditionSubject !== null && conditionSubject !== undefined) {
      return conditionSubject as TestSubject;
    }
    if (
      stepTwoHook.categoryTreeBySubject[DEFAULT_TEST_TABLE_SECTION_SUBJECT] !==
      undefined
    ) {
      return DEFAULT_TEST_TABLE_SECTION_SUBJECT;
    }
    const firstSubject = Object.keys(stepTwoHook.categoryTreeBySubject)[0] as
      | TestSubject
      | undefined;
    return firstSubject ?? null;
  }, [
    selectedSubject,
    stepTwoState.categoryTable,
    stepTwoHook.categoryTreeBySubject,
  ]);

  const saveCategoryCondition = useCallback((subject: TestSubject | null) => {
    if (subject === null) return;
    const draft = useWorkbookDraftStore.getState();
    const {
      sections,
      sectionMode,
      settings,
      lastAppliedDrawConditionKey,
      lastSavedOrRestoredTableKey,
    } = useTestTableStore.getState();
    const categoryTable = structuredClone(draft.stepTwo.categoryTable);
    const testTable = normalizeWorkbookTestTableForConditions(
      {
        sections,
        sectionMode,
        settings,
        lastAppliedDrawConditionKey,
        lastSavedOrRestoredTableKey,
      },
      categoryTable,
    );

    subjectCacheRef.current.set(subject, {
      categoryTable,
      testTable: structuredClone(testTable),
    });
  }, []);

  const loadCategoryCondition = useCallback(
    (subject: TestSubject) => {
      const cached = subjectCacheRef.current.get(subject);
      if (cached === undefined) return;
      storeActions.replaceCategoryConditions(
        structuredClone(cached.categoryTable),
      );
      useTestTableStore.setState(structuredClone(cached.testTable));
    },
    [storeActions],
  );

  const changeWorkbookSubject = useCallback(
    (nextSubject: TestSubject) => {
      if (nextSubject === effectiveSelectedSubject) return;
      saveCategoryCondition(effectiveSelectedSubject);
      resetPanel(['category', 'testTable', 'difficulty', 'preview']);
      loadCategoryCondition(nextSubject);
      setSelectedSubject(nextSubject);
    },
    [
      effectiveSelectedSubject,
      loadCategoryCondition,
      resetPanel,
      saveCategoryCondition,
    ],
  );

  const stepOne: CreatePdfStepOneAdapter = {
    basic,
    output: stepThreeState,
    onTitleChange: (v) => storeActions.setBasic({ title: v }),
    onRequestGradeChange: requestGradeChange,
    onRequestReset: () => {
      requestResetAll();
    },
    yearFilter,
  };

  const stepTwo: CreatePdfWorkbookStepTwoAdapter = {
    ...stepTwoHook,
    updateWorkbookMode: requestWorkbookModeChange,
    tagOptions,
    selectedSubject: effectiveSelectedSubject,
    onSubjectChange: changeWorkbookSubject,
  };

  const rows = testTableSections[0]?.rows ?? [];
  const stepThree: CreatePdfStepThreeAdapter = {
    output: stepThreeState,
    previewHealth,
    hasUnsavedTableChanges,
    canExport: rows.length > 0,
    onOutputChange: (patch) => storeActions.setStepThree(patch),
  };

  return {
    stepOne,
    stepTwo,
    stepThree,
    derived: {
      hasUnsavedTableChanges,
    },
    dialogs: {
      gradeChange: {
        isOpen: gradeDialogOpen,
        pendingGrade,
      },
      resetAll: {
        isOpen: resetDialogOpen,
      },
      workbookModeChange: {
        isOpen: workbookModeDialogOpen,
        pendingWorkbookMode,
      },
    },
    commands: {
      resetPanel,
      resetAll,
      requestResetAll,
      confirmResetAll,
      cancelResetAll,
      requestGradeChange,
      confirmGradeChange,
      cancelGradeChange,
      confirmWorkbookModeChange,
      cancelWorkbookModeChange,
    },
  };
};

export default useWorkbookPanelModel;

import type { TestSubject } from '@shared/types/contracts';
import { createExamTableKey } from '@views/createPdf/api/createPdfConditionKeys';
import { deriveYearFilterOptions } from '@views/createPdf/api/createPdfDerivedInputs';
import {
  createInitialDifficultyState,
  createInitialExamState,
} from '@views/createPdf/api/createPdfDraftFactory';
import {
  EXAM_REQUIRED_COUNTS_BY_GRADE,
  EXAM_SUBJECTS_BY_GRADE,
} from '@views/createPdf/api/examMockTable';
import { useOtherTagOptions } from '@views/createPdf/hooks/useOtherTagOptions';
import { getDefaultSelectedYears } from '@views/createPdf/hooks/useTestYears';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import type {
  ExamState,
  ExamStepTwoState,
} from '@views/createPdf/types/draftState';
import type {
  CreatePdfExamStepTwoAdapter,
  CreatePdfStepOneAdapter,
  CreatePdfStepThreeAdapter,
  ExamSubjectForUI,
  ResetPanelOptions,
  ResetPanelTarget,
} from '@views/createPdf/types/panelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import { getCreatePdfPreviewHealth } from '@views/createPdf/types/viewState';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import useExamStepTwo from './useExamStepTwo';
import { useTestYears } from './useTestYears';

type UseExamPanelModelInput = {
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'setGradeChangeDialogOpen'
  >;
};

/**
 * exam panel の唯一の入口となる panel model hook。
 * useWorkbookPanelModel と同じ責務構造を持ち、差分は stepTwo のみ。
 */
const useExamPanelModel = (input?: UseExamPanelModelInput) => {
  const { basic, stepThreeState, storeActions } = useExamDraftStore(
    useShallow((s) => ({
      basic: s.basic,
      stepThreeState: s.stepThree,
      storeActions: s.actions,
    })),
  );
  const { testTableSections, lastSavedOrRestoredTableKey } = useTestTableStore(
    useShallow((s) => ({
      testTableSections: s.sections,
      lastSavedOrRestoredTableKey: s.lastSavedOrRestoredTableKey,
    })),
  );

  const currentPreviewState = useCreatePdfViewStore(
    (s) => s.currentPreviewState,
  );

  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<1 | 2 | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleSelectedYearsChange = useCallback(
    (value: string[] | null) => {
      const current = useExamDraftStore.getState();
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

  const stepTwoHook = useExamStepTwo({
    selectedYearNos: yearFilter.selectedYearNos,
  });

  const { tagOptions } = useOtherTagOptions({ grade: basic.grade });

  const subjectsForUi: ExamSubjectForUI[] = useMemo(() => {
    return EXAM_SUBJECTS_BY_GRADE[basic.grade].map((subject, i) => ({
      id: `subject${i + 1}`,
      label: subject,
      count:
        (
          EXAM_REQUIRED_COUNTS_BY_GRADE[basic.grade] as Record<
            TestSubject,
            number
          >
        )[subject] ?? 0,
    }));
  }, [basic.grade]);

  const previewHealth = useMemo(
    () => getCreatePdfPreviewHealth(currentPreviewState),
    [currentPreviewState],
  );

  const hasUnsavedTableChanges = useMemo(() => {
    const currentKey = createExamTableKey(testTableSections);
    return currentKey !== lastSavedOrRestoredTableKey;
  }, [testTableSections, lastSavedOrRestoredTableKey]);

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
      const current = useExamDraftStore.getState();
      const initial = createInitialExamState();
      const nextGrade = options.grade ?? current.basic.grade;
      const nextSelectedYears =
        options.grade !== undefined && options.grade !== current.basic.grade
          ? null
          : resolveDefaultSelectedYears();

      const nextBasic: ExamState['basic'] = {
        ...current.basic,
        grade: nextGrade,
        ...(targetSet.has('title') ? { title: initial.basic.title } : {}),
        ...(targetSet.has('selectedYears')
          ? { selectedYears: nextSelectedYears }
          : {}),
      };

      const nextStepTwo: ExamStepTwoState = {
        ...current.stepTwo,
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
        useTestTableStore.getState().actions.reset();
      }
      if (targetSet.has('preview')) {
        useCreatePdfViewStore.getState().actions.setCurrentPreviewState(null);
      }
    },
    [resolveDefaultSelectedYears, storeActions],
  );

  const resetAll = useCallback(() => {
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

  const stepTwo: CreatePdfExamStepTwoAdapter = {
    ...stepTwoHook,
    tagOptions,
    subjectsForUi,
  };

  const stepThree: CreatePdfStepThreeAdapter = {
    output: stepThreeState,
    previewHealth,
    hasUnsavedTableChanges,
    canExport:
      testTableSections.some((s) => s.rows.length > 0) &&
      !hasUnsavedTableChanges,
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
    },
  };
};

export default useExamPanelModel;

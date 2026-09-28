import type { TestSubject } from '@shared/types/contracts';
import { createWorkbookDrawConditionKey } from '@views/createPdf/api/createPdfConditionKeys';
import { shouldShowQaaChoiceIndexForWorkbookMode } from '@views/createPdf/api/conditionJsonConverter';
import {
  createWorkbookCategoryTableRow,
  replaceWorkbookCategoryTableRow,
} from '@views/createPdf/api/workbookConditions';
import {
  buildWorkbookMockRows,
  getNextWorkbookMockSubject,
  type WorkbookMockSummary,
} from '@views/createPdf/api/workbookMockTable';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type {
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
} from '@views/createPdf/types/draftState';
import {
  DEFAULT_TEST_TABLE_SECTION_SUBJECT,
  type TestTableSection,
} from '@views/createPdf/types/testTable';
import type {
  WorkbookCategoryTableRow,
  WorkbookMode,
} from '@views/createPdf/types/viewState';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

const WORKBOOK_MODE_LABEL: Record<WorkbookMode, string> = {
  qaa: '一問一答',
  qaaAllTrue: '一問一答（全問◯）',
  qaaAllFalse: '一問一答（全問×）',
  multipleChoice: '選択肢',
};

const resolveWorkbookSectionSubject = (
  conditions: readonly WorkbookCategoryTableRow[],
): TestSubject => {
  const subjects = new Set<TestSubject>();
  for (const condition of conditions) {
    if (condition.subject !== null) {
      subjects.add(condition.subject as TestSubject);
    }
  }

  if (subjects.size === 1) {
    return [...subjects][0] ?? DEFAULT_TEST_TABLE_SECTION_SUBJECT;
  }
  return DEFAULT_TEST_TABLE_SECTION_SUBJECT;
};

const useWorkbookMockStepTwo = () => {
  const {
    basic: { grade },
    stepTwo,
    actions: { setWorkbookMode, setOptions },
  } = useWorkbookDraftStore(
    useShallow((state) => ({
      basic: state.basic,
      stepTwo: state.stepTwo,
      actions: state.actions,
    })),
  );
  const { setDifficulty, replaceCategoryConditions } = useWorkbookDraftStore(
    useShallow((state) => ({
      setDifficulty: state.actions.setDifficulty,
      replaceCategoryConditions: state.actions.replaceCategoryConditions,
    })),
  );

  const applyDrawResult = useTestTableStore((s) => s.actions.applyDrawResult);
  const tableRowCount = useTestTableStore(
    (s) => s.sections[0]?.rows.length ?? 0,
  );
  const setSettings = useTestTableStore((s) => s.actions.setSettings);

  const isLoadingTestData = useCreatePdfResourceStore(
    (state) => state.testData.isLoading,
  );
  const testDataByNo = useCreatePdfResourceStore(
    (state) => state.testData.maps.byNo,
  );

  const [summaries, setSummaries] = useState<WorkbookMockSummary[]>([]);

  // categoryTable と tableRowCount が両方 0 になったときにサマリーをリセットする
  useEffect(() => {
    if (stepTwo.categoryTable.length === 0 && tableRowCount === 0) {
      setSummaries([]);
    }
  }, [stepTwo.categoryTable.length, tableRowCount]);

  const updateWorkbookMode = useCallback(
    (value: WorkbookMode) => setWorkbookMode(value),
    [setWorkbookMode],
  );

  const updateOptions = useCallback(
    (patch: Partial<CreatePdfCommonOptionDraftState>) => setOptions(patch),
    [setOptions],
  );

  const updateDifficulty = useCallback(
    (patch: Partial<CreatePdfDifficultyDraftState>) => setDifficulty(patch),
    [setDifficulty],
  );

  const addCategoryCondition = useCallback(() => {
    const nextSubject = getNextWorkbookMockSubject(
      grade,
      stepTwo.categoryTable,
    );
    if (nextSubject == null) return;

    replaceCategoryConditions([
      ...stepTwo.categoryTable,
      {
        ...createWorkbookCategoryTableRow({
          subject: null,
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 100,
        }),
        subject: nextSubject,
      },
    ]);
  }, [grade, replaceCategoryConditions, stepTwo.categoryTable]);

  const updateCategoryCondition = useCallback(
    (
      conditionId: string,
      updater: (
        condition: WorkbookCategoryTableRow,
      ) => WorkbookCategoryTableRow,
    ) => {
      replaceCategoryConditions(
        replaceWorkbookCategoryTableRow(
          stepTwo.categoryTable,
          conditionId,
          updater,
        ),
      );
    },
    [replaceCategoryConditions, stepTwo.categoryTable],
  );

  const removeCategoryCondition = useCallback(
    (conditionId: string) => {
      replaceCategoryConditions(
        stepTwo.categoryTable.filter(
          (condition) => condition.id !== conditionId,
        ),
      );
    },
    [replaceCategoryConditions, stepTwo.categoryTable],
  );

  const generateTable = useCallback(() => {
    if (isLoadingTestData) return;

    const result = buildWorkbookMockRows({
      grade,
      workbookMode: stepTwo.workbookMode,
      conditions: stepTwo.categoryTable,
      testDataByNo,
    });

    const sections: TestTableSection[] = [
      {
        id: 'workbook-single',
        label: WORKBOOK_MODE_LABEL[stepTwo.workbookMode],
        subject: resolveWorkbookSectionSubject(stepTwo.categoryTable),
        rows: result.rows,
      },
    ];
    const { basic, stepTwo: s, stepThree } = useWorkbookDraftStore.getState();
    const drawConditionKey = createWorkbookDrawConditionKey({
      basic,
      stepTwo: s,
      stepThree,
    });
    applyDrawResult({ sections, drawConditionKey });
    setSummaries(result.summaries);
    setSettings({
      showQaaChoiceIndex: shouldShowQaaChoiceIndexForWorkbookMode(
        stepTwo.workbookMode,
      ),
    });
  }, [
    grade,
    isLoadingTestData,
    applyDrawResult,
    stepTwo.categoryTable,
    stepTwo.workbookMode,
    testDataByNo,
    setSettings,
  ]);

  return {
    workbookMode: stepTwo.workbookMode,
    options: stepTwo.options,
    difficulty: stepTwo.difficulty,
    categoryTable: stepTwo.categoryTable,
    summaries,
    isLoadingTestData,
    updateWorkbookMode,
    updateOptions,
    updateDifficulty,
    addCategoryCondition,
    updateCategoryCondition,
    removeCategoryCondition,
    generateTable,
  };
};

export default useWorkbookMockStepTwo;

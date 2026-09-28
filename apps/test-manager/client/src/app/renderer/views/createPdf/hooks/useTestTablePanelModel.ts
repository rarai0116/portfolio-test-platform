import {
  deriveActiveConditionIds,
  deriveCreatePdfCandidateIndex,
  deriveCreatePdfTestTableChecksCached,
  deriveSelectedYearNos,
  filterTestDataBySelectedYears,
} from '@views/createPdf/api/createPdfDerivedInputs';
import { deriveCreatePdfTestTableRowStatuses } from '@views/createPdf/api/createPdfTestTableStatus';
import { deriveTestTableRowAlerts } from '@views/createPdf/api/testTableRowAlerts';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';

/**
 * workbook / exam 共通の問題テーブルパネル用モデルフック。
 * useTestTableStore と useCreatePdfViewStore を購読して表示用データを返す。
 */
const useTestTablePanelModel = () => {
  const { sections, sectionMode, settings, updateRow } = useTestTableStore(
    useShallow((s) => ({
      sections: s.sections,
      sectionMode: s.sectionMode,
      settings: s.settings,
      updateRow: s.actions.updateRow,
    })),
  );

  const { isDirtyConditions, creationType } = useCreatePdfViewStore(
    useShallow((s) => ({
      isDirtyConditions: s.isDirtyConditions,
      creationType: s.creationType,
    })),
  );
  /*
  const isDirtyConditions = useCreatePdfViewStore((s) => s.isDirtyConditions);
  const creationType = useCreatePdfViewStore((s) => s.creationType);
  */

  const {
    workbookIsShuffleChoices,
    workbookSelectedYears,
    workbookGrade,
    workbookMode,
    workbookOptions,
    workbookCategoryTable,
  } = useWorkbookDraftStore(
    useShallow((s) => ({
      workbookIsShuffleChoices: s.stepTwo.options.isShuffleChoices,
      workbookSelectedYears: s.basic.selectedYears,
      workbookGrade: s.basic.grade,
      workbookMode: s.stepTwo.workbookMode,
      workbookOptions: s.stepTwo.options,
      workbookCategoryTable: s.stepTwo.categoryTable,
    })),
  );

  const {
    examIsShuffleChoices,
    examGrade,
    examSelectedYears,
    examOptions,
    examCategoryTable,
  } = useExamDraftStore(
    useShallow((s) => ({
      examIsShuffleChoices: s.stepTwo.options.isShuffleChoices,
      examGrade: s.basic.grade,
      examSelectedYears: s.basic.selectedYears,
      examOptions: s.stepTwo.options,
      examCategoryTable: s.stepTwo.categoryTable,
    })),
  );
  const isShuffleChoices =
    creationType === 'workbook'
      ? workbookIsShuffleChoices
      : examIsShuffleChoices;
  const testDataByNo = useCreatePdfResourceStore((s) => s.testData.maps.byNo);
  const selectedYears =
    creationType === 'workbook' ? workbookSelectedYears : examSelectedYears;
  const grade = creationType === 'workbook' ? workbookGrade : examGrade;
  const options = creationType === 'workbook' ? workbookOptions : examOptions;
  const activeConditionIds = useMemo(
    () =>
      deriveActiveConditionIds(
        creationType === 'workbook' ? workbookCategoryTable : examCategoryTable,
      ),
    [creationType, workbookCategoryTable, examCategoryTable],
  );

  const selectedYearNos = useMemo(() => {
    return deriveSelectedYearNos(testDataByNo, selectedYears);
  }, [selectedYears, testDataByNo]);

  // 候補Index: 年度フィルタ・出題オプションを反映した問題Noサジェスト用
  const candidateIndex = useMemo(() => {
    if (testDataByNo.size === 0) return undefined;
    const filteredMap = filterTestDataBySelectedYears(
      testDataByNo,
      selectedYearNos,
    );
    return deriveCreatePdfCandidateIndex({
      filteredTestDataByNo: filteredMap,
      allTestDataByNo: testDataByNo,
      fixedTestDataByNo: testDataByNo,
      workbookMode: creationType === 'workbook' ? workbookMode : undefined,
      grade: grade as 1 | 2 | undefined,
      options,
    });
  }, [
    testDataByNo,
    selectedYearNos,
    creationType,
    workbookMode,
    grade,
    options,
  ]);

  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections,
        testDataByNo,
        showQaaChoiceIndex: settings.showQaaChoiceIndex,
        grade,
        sectionMode,
        activeConditionIds,
      }),
    [
      sections,
      testDataByNo,
      settings.showQaaChoiceIndex,
      grade,
      sectionMode,
      activeConditionIds,
    ],
  );

  const warningMarkersByRowKey = useMemo(() => {
    const result = new Map();
    for (const section of sections) {
      for (const row of section.rows) {
        const markers = deriveTestTableRowAlerts({
          row,
          testDataByNo,
          selectedYearNos,
          excludedTagIds: options.excludedTagIds,
          workbookMode: creationType === 'workbook' ? workbookMode : null,
          showQaaChoiceIndex: settings.showQaaChoiceIndex,
        });
        if (markers.length > 0) {
          result.set(`${section.id}:${row.id}`, markers);
        }
      }
    }
    return result;
  }, [
    sections,
    testDataByNo,
    selectedYearNos,
    options.excludedTagIds,
    creationType,
    workbookMode,
    settings.showQaaChoiceIndex,
  ]);

  const rowStatuses = useMemo(
    () =>
      deriveCreatePdfTestTableRowStatuses({
        sections,
        checks: testTableChecks,
        warningMarkersByRowKey,
      }),
    [sections, testTableChecks, warningMarkersByRowKey],
  );

  return {
    sections,
    sectionMode,
    settings,
    updateRow,
    isDirtyConditions,
    isShuffleChoices,
    testDataByNo,
    candidateIndex,
    rowStatuses,
    grade,
  };
};

export default useTestTablePanelModel;

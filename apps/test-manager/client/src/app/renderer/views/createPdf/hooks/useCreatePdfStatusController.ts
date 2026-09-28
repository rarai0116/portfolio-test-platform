import { buildSlotKey } from '@shared/types/pdfPreview';
import {
  createExamDrawConditionKey,
  createExamTableKey,
  createWorkbookDrawConditionKey,
} from '@views/createPdf/api/createPdfConditionKeys';
import {
  deriveActiveConditionIds,
  deriveCreatePdfCandidateIndex,
  deriveCreatePdfTestTableChecksCached,
  deriveSelectedYearNos,
  filterTestDataBySelectedYears,
} from '@views/createPdf/api/createPdfDerivedInputs';
import { deriveCreatePdfDrawConditionChangeStatus } from '@views/createPdf/api/createPdfDrawConditionChangeStatus';
import { deriveCreatePdfDrawStatus } from '@views/createPdf/api/createPdfDrawStatus';
import { deriveCreatePdfExportStatus } from '@views/createPdf/api/createPdfExportStatus';
import { deriveCreatePdfPreviewStatus } from '@views/createPdf/api/createPdfPreviewStatus';
import {
  buildExamDrawSlots,
  buildWorkbookDrawSlots,
} from '@views/createPdf/api/drawEngine';
import { reconnectExamTableRowsToCategoryRows } from '@views/createPdf/api/examTableRows';
import { useCreatePdfPreviewUpdateControllerStore } from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type { CreatePdfUserStatusSnapshot } from '@views/createPdf/types/statusState';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

/**
 * PDF作成View配下の正本storeからユーザー確認用statusを導出し、read model storeへ反映する。
 * ここ以外から useCreatePdfStatusStore を更新しない。
 */
export const useCreatePdfStatusController = () => {
  const { creationType, currentPreviewState } = useCreatePdfViewStore(
    useShallow((state) => ({
      creationType: state.creationType,
      currentPreviewState: state.currentPreviewState,
    })),
  );
  const { workbookBasic, workbookStepTwo, workbookOutput } =
    useWorkbookDraftStore(
      useShallow((state) => ({
        workbookBasic: state.basic,
        workbookStepTwo: state.stepTwo,
        workbookOutput: state.stepThree,
      })),
    );
  const { examBasic, examStepTwo, examOutput } = useExamDraftStore(
    useShallow((state) => ({
      examBasic: state.basic,
      examStepTwo: state.stepTwo,
      examOutput: state.stepThree,
    })),
  );
  const testTable = useTestTableStore(
    useShallow((state) => ({
      sections: state.sections,
      sectionMode: state.sectionMode,
      settings: state.settings,
      lastAppliedDrawConditionKey: state.lastAppliedDrawConditionKey,
      lastSavedOrRestoredTableKey: state.lastSavedOrRestoredTableKey,
    })),
  );
  const { lastMeta, isCommitting } = useCreatePdfPreviewUpdateControllerStore(
    useShallow((state) => ({
      lastMeta: state.lastMeta,
      isCommitting: state.isCommitting,
    })),
  );
  const { previewWindowStatus, isExporting, isBfsCalculating } =
    useCreatePdfStatusRuntimeStore(
      useShallow((state) => ({
        previewWindowStatus: state.previewWindowStatus,
        isExporting: state.isExporting,
        isBfsCalculating: state.isBfsCalculating,
      })),
    );
  const testDataByNo = useCreatePdfResourceStore((s) => s.testData.maps.byNo);
  const replaceSnapshot = useCreatePdfStatusStore(
    (state) => state.actions.replaceSnapshot,
  );

  const activeBasic = creationType === 'workbook' ? workbookBasic : examBasic;
  const activeStepTwo =
    creationType === 'workbook' ? workbookStepTwo : examStepTwo;
  const activeOutput =
    creationType === 'workbook' ? workbookOutput : examOutput;

  const selectedYearNos = useMemo(
    () => deriveSelectedYearNos(testDataByNo, activeBasic.selectedYears),
    [testDataByNo, activeBasic.selectedYears],
  );
  const filteredTestDataByNo = useMemo(
    () => filterTestDataBySelectedYears(testDataByNo, selectedYearNos),
    [testDataByNo, selectedYearNos],
  );
  const activeConditionIds = useMemo(
    () => deriveActiveConditionIds(activeStepTwo.categoryTable),
    [activeStepTwo.categoryTable],
  );
  const currentDrawConditionKey = useMemo(
    () =>
      creationType === 'workbook'
        ? createWorkbookDrawConditionKey({
            basic: workbookBasic,
            stepTwo: workbookStepTwo,
          })
        : createExamDrawConditionKey({
            basic: examBasic,
            stepTwo: examStepTwo,
          }),
    [creationType, workbookBasic, workbookStepTwo, examBasic, examStepTwo],
  );
  const slotKey = useMemo(
    () =>
      buildSlotKey({
        grade: activeBasic.grade,
        workbookMode:
          creationType === 'workbook' ? workbookStepTwo.workbookMode : null,
      }),
    [activeBasic.grade, creationType, workbookStepTwo.workbookMode],
  );
  const hasOutputRows = useMemo(
    () =>
      testTable.sections.some((s) => s.rows.some((r) => r.selectedNo != null)),
    [testTable.sections],
  );
  const drawConditionChangeStatus = useMemo(
    () =>
      deriveCreatePdfDrawConditionChangeStatus({
        currentDrawConditionKey,
        lastAppliedDrawConditionKey: testTable.lastAppliedDrawConditionKey,
        hasOutputRows,
      }),
    [
      currentDrawConditionKey,
      testTable.lastAppliedDrawConditionKey,
      hasOutputRows,
    ],
  );
  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections: testTable.sections,
        testDataByNo,
        showQaaChoiceIndex: testTable.settings.showQaaChoiceIndex,
        grade: activeBasic.grade,
        sectionMode: testTable.sectionMode,
        activeConditionIds,
      }),
    [
      testTable.sections,
      testDataByNo,
      testTable.settings.showQaaChoiceIndex,
      activeBasic.grade,
      testTable.sectionMode,
      activeConditionIds,
    ],
  );
  const candidateIndex = useMemo(
    () =>
      deriveCreatePdfCandidateIndex({
        filteredTestDataByNo,
        allTestDataByNo: testDataByNo,
        fixedTestDataByNo: testDataByNo,
        workbookMode:
          creationType === 'workbook'
            ? workbookStepTwo.workbookMode
            : undefined,
        grade: activeBasic.grade,
        options: activeStepTwo.options,
      }),
    [
      filteredTestDataByNo,
      testDataByNo,
      creationType,
      workbookStepTwo.workbookMode,
      activeBasic.grade,
      activeStepTwo.options,
    ],
  );
  const previewStatus = useMemo(
    () =>
      deriveCreatePdfPreviewStatus({
        creationType,
        slotKey,
        currentPreviewState,
        lastMeta,
        previewWindowStatus,
        isCommitting,
      }),
    [
      creationType,
      slotKey,
      currentPreviewState,
      lastMeta,
      previewWindowStatus,
      isCommitting,
    ],
  );
  const currentTableKey = useMemo(
    () =>
      creationType === 'workbook'
        ? JSON.stringify(testTable.sections)
        : createExamTableKey(testTable.sections),
    [creationType, testTable.sections],
  );
  const hasUnsavedTableChanges =
    testTable.lastSavedOrRestoredTableKey !== null &&
    currentTableKey !== testTable.lastSavedOrRestoredTableKey;
  const sectionsForDrawStatus = useMemo(
    () =>
      creationType === 'exam'
        ? reconnectExamTableRowsToCategoryRows({
            categoryRows: examStepTwo.categoryTable,
            sections: testTable.sections,
          })
        : testTable.sections,
    [creationType, examStepTwo.categoryTable, testTable.sections],
  );
  const fixedRows = useMemo(
    () =>
      sectionsForDrawStatus.flatMap((section) =>
        section.rows.filter((row) => row.isFixed),
      ),
    [sectionsForDrawStatus],
  );
  const allRows = useMemo(
    () => sectionsForDrawStatus.flatMap((section) => section.rows),
    [sectionsForDrawStatus],
  );
  const drawSlots = useMemo(
    () =>
      creationType === 'workbook'
        ? buildWorkbookDrawSlots(
            workbookStepTwo.categoryTable,
            fixedRows,
            allRows,
          )
        : buildExamDrawSlots(
            examStepTwo.categoryTable,
            fixedRows,
            examBasic.grade,
          ),
    [
      creationType,
      workbookStepTwo.categoryTable,
      examStepTwo.categoryTable,
      examBasic.grade,
      fixedRows,
      allRows,
    ],
  );
  const conditionRequirements = useMemo(
    () =>
      creationType === 'workbook'
        ? new Map(
            workbookStepTwo.categoryTable.map((row) => [
              row.id,
              Math.max(0, row.count),
            ]),
          )
        : new Map(examStepTwo.categoryTable.map((row) => [row.id, 1])),
    [creationType, workbookStepTwo.categoryTable, examStepTwo.categoryTable],
  );
  const drawStatus = useMemo(
    () =>
      deriveCreatePdfDrawStatus({
        hasCategoryConditions: activeStepTwo.categoryTable.length > 0,
        candidateIndex,
        testTableChecks,
        slots: drawSlots,
        fixedRows,
        conditionRequirements,
        isBfsCalculating,
      }),
    [
      activeStepTwo.categoryTable.length,
      candidateIndex,
      testTableChecks,
      drawSlots,
      fixedRows,
      conditionRequirements,
      isBfsCalculating,
    ],
  );
  const exportStatus = useMemo(
    () =>
      deriveCreatePdfExportStatus({
        outputDirectory: activeOutput.selectedOutputFolder?.trim() ?? '',
        hasUnsavedTableChanges,
        isExporting,
        previewStatus,
        testTableChecks,
        drawConditionChangeStatus,
      }),
    [
      activeOutput.selectedOutputFolder,
      hasUnsavedTableChanges,
      isExporting,
      previewStatus,
      testTableChecks,
      drawConditionChangeStatus,
    ],
  );
  const sourceRevision = useMemo(
    () =>
      JSON.stringify({
        currentDrawConditionKey,
        tableKey: currentTableKey,
        previewRevision: currentPreviewState?.revision ?? null,
        previewWindowRevision: previewWindowStatus.revision,
        previewWindowOpen: previewWindowStatus.isOpen,
        isCommitting,
        isExporting,
      }),
    [
      currentDrawConditionKey,
      currentTableKey,
      currentPreviewState?.revision,
      previewWindowStatus.revision,
      previewWindowStatus.isOpen,
      isCommitting,
      isExporting,
    ],
  );
  const snapshot = useMemo<CreatePdfUserStatusSnapshot>(() => {
    return {
      exportStatus,
      previewStatus,
      drawStatus,
      drawConditionChangeStatus,
      meta: {
        computedAt: 0,
        creationType,
        slotKey,
        sourceRevision,
      },
    };
  }, [
    exportStatus,
    previewStatus,
    drawStatus,
    drawConditionChangeStatus,
    creationType,
    slotKey,
    sourceRevision,
  ]);

  useEffect(() => {
    replaceSnapshot(snapshot);
  }, [replaceSnapshot, snapshot]);
};

import { buildWorkbookPdfFileName } from '@api/buildWorkbookPdfFileName';
import {
  exportCreatePdf,
  getCreatePdfPreviewWindowStatus,
  onCreatePdfPreviewWindowClosed,
  openCreatePdfPreviewWindow,
  selectCreatePdfOutputDirectory,
} from '@renderer/api/createPdfExportBridge';
import { buildSlotKey } from '@shared/types/pdfPreview';
import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import { buildWorkbookConditionJson } from '@views/createPdf/api/conditionJsonConverter';
import { deriveCreatePdfTestTableChecksCached } from '@views/createPdf/api/createPdfDerivedInputs';
import { deriveCreatePdfExportStatus } from '@views/createPdf/api/createPdfExportStatus';
import { deriveCreatePdfPreviewStatus } from '@views/createPdf/api/createPdfPreviewStatus';
import { toStatusMessages } from '@views/createPdf/api/createPdfStatusReasons';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore, {
  CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
} from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type { CreatePdfStepThreeAdapter } from '@views/createPdf/types/panelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

type UseWorkbookPdfExportInput = {
  stepThree: CreatePdfStepThreeAdapter;
  previewUpdate: CreatePdfPreviewUpdateAdapter;
};

type WorkbookPdfExportResultState = {
  outputFolderPath: string;
  files: string[];
};

const PREVIEW_WINDOW_STATUS_POLL_MS = 300;

const useWorkbookPdfExport = ({
  stepThree,
  previewUpdate,
}: UseWorkbookPdfExportInput) => {
  const { basic, workbookMode } = useWorkbookDraftStore(
    useShallow((state) => {
      return {
        basic: state.basic,
        workbookMode: state.stepTwo.workbookMode,
      };
    }),
  );

  const currentPreviewState = useCreatePdfViewStore(
    useShallow((state) => state.currentPreviewState),
  );
  const drawConditionChangeStatus = useCreatePdfStatusStore(
    useShallow((state) => state.drawConditionChangeStatus),
  );
  const { testTableSections, testTableSettings, testTableSectionMode } =
    useTestTableStore(
      useShallow((state) => ({
        testTableSections: state.sections,
        testTableSettings: state.settings,
        testTableSectionMode: state.sectionMode,
      })),
    );

  const testDataByNo = useCreatePdfResourceStore(
    useShallow((state) => state.testData.maps.byNo),
  );
  const {
    previewWindowStatus,
    isExporting,
    setPreviewWindowStatus,
    setIsExporting,
  } = useCreatePdfStatusRuntimeStore(
    useShallow((state) => ({
      previewWindowStatus: state.previewWindowStatus,
      isExporting: state.isExporting,
      setPreviewWindowStatus: state.actions.setPreviewWindowStatus,
      setIsExporting: state.actions.setIsExporting,
    })),
  );

  const [isSelectingOutputDirectory, setIsSelectingOutputDirectory] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastExportResult, setLastExportResult] =
    useState<WorkbookPdfExportResultState | null>(null);

  const slotKey = useMemo(
    () =>
      buildSlotKey({
        grade: basic.grade,
        workbookMode,
      }),
    [basic.grade, workbookMode],
  );

  const expectedFileNames = useMemo(() => {
    const fileNames = [
      buildWorkbookPdfFileName({
        grade: basic.grade,
        title: basic.title,
        workbookMode,
      }),
    ];
    if (stepThree.output.saveConditionJson) {
      fileNames.push('出題条件.json');
    }
    return fileNames;
  }, [
    basic.grade,
    basic.title,
    workbookMode,
    stepThree.output.saveConditionJson,
  ]);
  const outputDirectory = stepThree.output.selectedOutputFolder?.trim() ?? '';

  const refreshPreviewWindowStatus = useCallback(async () => {
    const result = await getCreatePdfPreviewWindowStatus();
    if (!result.ok) {
      return;
    }

    setPreviewWindowStatus((prev) => {
      const next = result.status;
      if (
        prev.isOpen === next.isOpen &&
        prev.isReady === next.isReady &&
        prev.isRendering === next.isRendering &&
        prev.revision === next.revision &&
        prev.slotKey === next.slotKey &&
        prev.creationType === next.creationType
      ) {
        return prev; // 同じ内容なら前の参照を保持 → 再レンダリングなし
      }
      return next;
    });
  }, [setPreviewWindowStatus]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみ
  useEffect(() => {
    void refreshPreviewWindowStatus();
    // ウィンドウ閉鎖通知を受信し status を即時更新する
    return onCreatePdfPreviewWindowClosed(() => {
      setPreviewWindowStatus(CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS);
    });
  }, []);

  const shouldPollPreviewWindowStatus = useMemo(() => {
    return (
      previewWindowStatus.isOpen &&
      (previewWindowStatus.isRendering ||
        !previewWindowStatus.isReady ||
        (previewUpdate.lastMeta !== null &&
          previewWindowStatus.revision !== previewUpdate.lastMeta.revision))
    );
  }, [previewWindowStatus, previewUpdate.lastMeta]);

  useEffect(() => {
    if (!shouldPollPreviewWindowStatus) {
      return;
    }

    // PreviewWindow 側の bridge 状態は open 後に遅れて確定するため、短時間だけ追従する。
    void refreshPreviewWindowStatus();
    const timerId = window.setInterval(() => {
      void refreshPreviewWindowStatus();
    }, PREVIEW_WINDOW_STATUS_POLL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [refreshPreviewWindowStatus, shouldPollPreviewWindowStatus]);

  // 「プレビューを更新」ボタンを通じた commit + ウィンドウが閉じている場合は先に開く
  const requestManualCommit = useCallback(async () => {
    if (!previewWindowStatus.isOpen) {
      await openCreatePdfPreviewWindow({ creationType: 'workbook', slotKey });
      await refreshPreviewWindowStatus();
    }
    await previewUpdate.requestManualCommit();
  }, [
    previewWindowStatus.isOpen,
    slotKey,
    refreshPreviewWindowStatus,
    previewUpdate,
  ]);

  const selectOutputDirectory = useCallback(async () => {
    setErrorMessage(null);
    setIsSelectingOutputDirectory(true);

    try {
      const result = await selectCreatePdfOutputDirectory({
        defaultPath: stepThree.output.selectedOutputFolder,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      if (result.selectedPath) {
        stepThree.onOutputChange({ selectedOutputFolder: result.selectedPath });
      }
    } finally {
      setIsSelectingOutputDirectory(false);
    }
  }, [stepThree]);

  const exportPdf = useCallback(async () => {
    setErrorMessage(null);

    const lastMeta = previewUpdate.lastMeta;
    if (!lastMeta) {
      setErrorMessage('プレビュー更新が完了するまでお待ちください。');
      return;
    }

    if (!outputDirectory) {
      setErrorMessage('出力先フォルダを選択してください');
      return;
    }

    const loadingId = useGlobalLoadingStore
      .getState()
      .show('PDFを書き出しています…');
    setIsExporting(true);

    try {
      // saveConditionJson が true の場合のみ出題条件JSONを生成して保存
      const conditionJson = stepThree.output.saveConditionJson
        ? buildWorkbookConditionJson(
            useWorkbookDraftStore.getState(),
            useTestTableStore.getState(),
            useCreatePdfResourceStore.getState().testData.maps.byNo,
          )
        : null;

      const result = await exportCreatePdf({
        creationType: 'workbook',
        slotKey: lastMeta.slotKey,
        expectedRevision: lastMeta.revision,
        outputDirectory,
        includeCover: stepThree.output.includeCover,
        conditionJson,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setLastExportResult({
        outputFolderPath: result.outputFolderPath,
        files: result.files,
      });
      await refreshPreviewWindowStatus();
    } finally {
      setIsExporting(false);
      useGlobalLoadingStore.getState().hide(loadingId);
    }
  }, [
    previewUpdate.lastMeta,
    refreshPreviewWindowStatus,
    setIsExporting,
    stepThree,
    outputDirectory,
  ]);

  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections: testTableSections,
        testDataByNo,
        showQaaChoiceIndex: testTableSettings.showQaaChoiceIndex,
        grade: basic.grade,
        sectionMode: testTableSectionMode,
      }),
    [
      testTableSections,
      testDataByNo,
      testTableSettings.showQaaChoiceIndex,
      basic.grade,
      testTableSectionMode,
    ],
  );

  const previewStatus = useMemo(
    () =>
      deriveCreatePdfPreviewStatus({
        creationType: 'workbook',
        slotKey,
        currentPreviewState,
        lastMeta: previewUpdate.lastMeta,
        previewWindowStatus,
        isCommitting: previewUpdate.isCommitting,
      }),
    [
      slotKey,
      currentPreviewState,
      previewUpdate.lastMeta,
      previewUpdate.isCommitting,
      previewWindowStatus,
    ],
  );

  const exportStatus = useMemo(
    () =>
      deriveCreatePdfExportStatus({
        outputDirectory,
        hasUnsavedTableChanges: stepThree.hasUnsavedTableChanges,
        isExporting,
        previewStatus,
        testTableChecks,
        drawConditionChangeStatus,
      }),
    [
      outputDirectory,
      stepThree.hasUnsavedTableChanges,
      isExporting,
      previewStatus,
      testTableChecks,
      drawConditionChangeStatus,
    ],
  );

  const warningMessages = useMemo(
    () => toStatusMessages(exportStatus.warningReasons),
    [exportStatus.warningReasons],
  );

  const isPreviewWindowReadyForExport =
    previewWindowStatus.isOpen &&
    previewWindowStatus.isReady &&
    previewWindowStatus.creationType === 'workbook' &&
    previewWindowStatus.slotKey === slotKey &&
    previewUpdate.lastMeta !== null;

  const blockingReasons = useMemo(
    () => toStatusMessages(exportStatus.blockingReasons),
    [exportStatus.blockingReasons],
  );

  const canExportFromUi =
    exportStatus.canExport && isPreviewWindowReadyForExport;
  const hasUnappliedConditionsWarning = exportStatus.warningReasons.some(
    (r) => r.code === 'unapplied-draw-conditions',
  );

  return {
    outputDirectory: stepThree.output.selectedOutputFolder,
    expectedFileNames,
    warningMessages,
    blockingReasons,
    lastExportResult,
    errorMessage,
    isSelectingOutputDirectory,
    isExporting,
    isPreviewWindowOpen: previewWindowStatus.isOpen,
    canExportFromUi,
    hasUnappliedConditionsWarning,
    selectOutputDirectory,
    exportPdf,
    requestManualCommit,
  };
};

export default useWorkbookPdfExport;

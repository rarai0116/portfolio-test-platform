import BasicDialog from '@parts/basicDialog';
import { Separator } from '@ui/separator';
import useExamPanelModel from '@views/createPdf/hooks/useExamPanelModel';
import useExamPdfExport from '@views/createPdf/hooks/useExamPdfExport';
import { useLoadConditionJson } from '@views/createPdf/hooks/useLoadConditionJson';
import DifficultyAdjustment from '@views/createPdf/organisms/difficultyAdjustment';
import ExamCategory from '@views/createPdf/organisms/examCategory';
import ExamYearFilter from '@views/createPdf/organisms/examYearFilter';
import ExportPdf from '@views/createPdf/organisms/exportPdf';
import OptionCondition from '@views/createPdf/organisms/optionCondition';
import JsonLoadButtons from '@views/createPdf/parts/jsonButtons';
import PreviewWindowReopenButton from '@views/createPdf/parts/previewWindowReopenButton';
import ResetButton from '@views/createPdf/parts/resetButton';
import useCreatePdfPreviewUpdateController from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import StatusDot from '../../../components/parts/statusDot';
import BasicCondition from '../organisms/basicCondition';
import ExportPdfStatusMessage from '../organisms/exportPdfStatusMessage';
import GradeChangeDialog from '../organisms/gradeChangeDialog';
import ResetConfirmDialog from '../organisms/resetConfirmDialog';
import DrawButton from '../parts/drawButton';
import DrawStatusMessage from '../parts/drawStatusMessage';
import ExportPdfButton from '../parts/exportPdfButton';
import StepperButtons from '../parts/stepperButtons';

const ExamPanel = () => {
  const previewUpdate = useCreatePdfPreviewUpdateController('exam');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const hasUnappliedDrawConditions = useCreatePdfStatusStore(
    (state) => state.drawConditionChangeStatus.hasUnappliedDrawConditions,
  );
  const isDrawn = useCreatePdfStatusStore(
    (state) =>
      state.drawConditionChangeStatus.lastAppliedDrawConditionKey !== null,
  );
  const isNotDrawn = useCreatePdfStatusStore(
    (state) => state.drawConditionChangeStatus.kind === 'not-drawn',
  );
  const drawStatus = useCreatePdfStatusStore((s) => s.drawStatus);
  const {
    exportStatusKind,
    previewStatusKind,
    previewReasons,
    exportBlockingReasons,
    exportWarningReasons,
  } = useCreatePdfStatusStore(
    useShallow((s) => ({
      exportStatusKind: s.exportStatus.kind,
      previewStatusKind: s.previewStatus.kind,
      previewReasons: s.previewStatus.reasons,
      exportBlockingReasons: s.exportStatus.blockingReasons,
      exportWarningReasons: s.exportStatus.warningReasons,
    })),
  );
  const model = useExamPanelModel({ previewUpdate });
  const tableSections = useTestTableStore((s) => s.sections);
  const pdfExport = useExamPdfExport({
    stepThree: model.stepThree,
    previewUpdate,
    subjects: tableSections.map((s) => s.label),
  });
  const loadJson = useLoadConditionJson('exam');

  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);

  const previewTooltip = useMemo(
    () => previewReasons.map((r) => r.message),
    [previewReasons],
  );
  // exportStatus の reasons には preview 起因の blocking も含まれる（設計仕様）ため、
  // 赤・黄の理由を拾えるためにそのまま表示する
  const exportTooltip = useMemo(
    () =>
      [...exportBlockingReasons, ...exportWarningReasons].map((r) => r.message),
    [exportBlockingReasons, exportWarningReasons],
  );

  useEffect(() => {
    model.stepTwo.initializeCategoryTableRows();
  }, [model.stepTwo.initializeCategoryTableRows]);

  const handleSetCurrentStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  return (
    <div className="bg-background relative w-full h-full flex flex-col min-w-0">
      <div className="w-full border-b bg-white px-6 py-3 flex min-w-0 items-center justify-between">
        <div className="flex gap-4">
          <StatusDot
            color={
              exportStatusKind === 'ready'
                ? 'green'
                : exportStatusKind === 'warning'
                  ? 'yellow'
                  : 'red'
            }
            label="PDF作成"
            tooltip={exportTooltip}
          />
          <StatusDot
            color={
              previewStatusKind === 'ready' ||
              previewStatusKind === 'has-issues'
                ? 'green'
                : previewStatusKind === 'rendering' ||
                    previewStatusKind === 'committing'
                  ? 'yellow'
                  : 'red'
            }
            label="プレビュー"
            tooltip={previewTooltip}
          />
          {!pdfExport.isPreviewWindowOpen && (
            <PreviewWindowReopenButton
              onClick={() => {
                void pdfExport.requestManualCommit();
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-4 h-full ">
          <div className="flex">
            <ResetButton onClick={model.commands.requestResetAll} />
            <JsonLoadButtons onLoad={loadJson.handleLoad} />
          </div>

          <Separator orientation="vertical" />
          <StepperButtons
            isDisabled={pdfExport.isExporting}
            currentStep={currentStep}
            setCurrentStep={handleSetCurrentStep}
          />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="flex flex-col px-9 py-4 gap-4">
          <GradeChangeDialog
            isOpen={model.dialogs.gradeChange.isOpen}
            pendingGrade={model.dialogs.gradeChange.pendingGrade}
            onConfirm={model.commands.confirmGradeChange}
            onCancel={model.commands.cancelGradeChange}
          />
          <ResetConfirmDialog
            open={model.dialogs.resetAll.isOpen}
            title="初期状態に戻しますか？"
            description="現在の級を保持したまま、タイトル・出題条件・問題テーブル・出力設定を初期状態に戻します。"
            onConfirm={model.commands.confirmResetAll}
            onCancel={model.commands.cancelResetAll}
          />
          <ResetConfirmDialog
            open={exportConfirmOpen}
            title="抽選条件が反映されていません"
            description="現在の問題テーブルは最新の抽選条件を反映していない可能性があります。このままPDFを作成しますか？"
            onConfirm={() => {
              setExportConfirmOpen(false);
              void pdfExport.exportPdf();
            }}
            onCancel={() => setExportConfirmOpen(false)}
          />

          <div className="flex flex-col gap-4">
            {currentStep === 1 ? (
              <>
                <div className="text-lg text-primary">条件設定</div>

                <div className="flex flex-col gap-6">
                  <BasicCondition
                    grade={model.stepOne.basic.grade}
                    creationType="exam"
                    onGradeChange={model.stepOne.onRequestGradeChange}
                    onTitleEditEnd={previewUpdate.endGuardedEdit}
                    onTitleEditStart={previewUpdate.beginGuardedEdit}
                    onTitleChange={model.stepOne.onTitleChange}
                    title={model.stepOne.basic.title}
                  />
                  <ExamYearFilter
                    sortedLabels={model.stepOne.yearFilter.sortedLabels}
                    selectedYears={
                      model.stepOne.yearFilter.effectiveSelectedYears
                    }
                    onSelectedYearsChange={
                      model.stepOne.yearFilter.onSelectedYearsChange
                    }
                    isLoading={model.stepOne.yearFilter.isLoadingTestData}
                  />
                  <ExamCategory
                    subjects={model.stepTwo.subjectsForUi}
                    categoryTableForUI={model.stepTwo.categoryTableForUI}
                    categoryTreeBySubject={model.stepTwo.categoryTreeBySubject}
                    onUpdateConditions={model.stepTwo.updateCategoryTableRow}
                    exhaustedCategoryKeysBySubject={
                      model.stepTwo.exhaustedCategoryKeysBySubject
                    }
                  />
                  <OptionCondition
                    tagOptions={model.stepTwo.tagOptions}
                    excludedTagIds={model.stepTwo.options.excludedTagIds}
                    excludePastExam={model.stepTwo.options.excludePastExam}
                    excludeOriginal={model.stepTwo.options.excludeOriginal}
                    isShuffleChoices={model.stepTwo.options.isShuffleChoices}
                    onExcludedTagIdsChange={(value) =>
                      model.stepTwo.updateOptions({ excludedTagIds: value })
                    }
                    onExcludePastExamChange={(value) =>
                      model.stepTwo.updateOptions({ excludePastExam: value })
                    }
                    onExcludeOriginalChange={(value) =>
                      model.stepTwo.updateOptions({ excludeOriginal: value })
                    }
                    onIsShuffleChoicesChange={(value) =>
                      model.stepTwo.updateOptions({ isShuffleChoices: value })
                    }
                  />
                  <DifficultyAdjustment
                    isCalculated={model.stepTwo.difficulty.isCalculated}
                    ratios={model.stepTwo.difficulty.ratios}
                    settableDifficultyRanges={
                      model.stepTwo.difficulty.settableDifficultyRanges
                    }
                    dynamicBounds={model.stepTwo.difficultySliderDynamicBounds}
                    onRatioCommit={model.stepTwo.onRatioCommit}
                    onCalculate={model.stepTwo.calculateDifficulty}
                    isCalculateDisabled={model.stepTwo.isCalculateDisabled}
                  />
                </div>
              </>
            ) : (
              <ExportPdf
                blockingReasons={pdfExport.blockingReasons}
                errorMessage={pdfExport.errorMessage}
                examDate={model.stepThree.output.examDate}
                excludeMiddleCover={model.stepThree.output.excludeMiddleCover}
                expectedFileNames={pdfExport.expectedFileNames}
                includeCover={model.stepThree.output.includeCover}
                isSelectingOutputDirectory={
                  pdfExport.isSelectingOutputDirectory
                }
                lastExportedFiles={pdfExport.lastExportResult?.files}
                lastOutputFolderPath={
                  pdfExport.lastExportResult?.outputFolderPath
                }
                onIncludeCoverChange={(v) =>
                  model.stepThree.onOutputChange({ includeCover: v })
                }
                onExcludeMiddleCoverChange={(v) =>
                  model.stepThree.onOutputChange({ excludeMiddleCover: v })
                }
                onExamDateChange={(v) =>
                  model.stepThree.onOutputChange({ examDate: v })
                }
                onSaveConditionJsonChange={(v) =>
                  model.stepThree.onOutputChange({ saveConditionJson: v })
                }
                onSelectOutputDirectory={() => {
                  void pdfExport.selectOutputDirectory();
                }}
                outputDirectory={pdfExport.outputDirectory}
                saveConditionJson={model.stepThree.output.saveConditionJson}
                showExamDateOption
                showExcludeMiddleCover
                warningMessages={pdfExport.warningMessages}
              />
            )}
          </div>
        </div>

        {currentStep !== 1 && (
          <div className="sticky bottom-0 z-10 w-full border-t  px-6 py-4 bg-white shadow-sm flex flex-wrap min-w-0 items-center justify-end gap-4">
            <ExportPdfStatusMessage
              isExporting={pdfExport.isExporting}
              errorMessage={pdfExport.errorMessage}
              isSuccess={pdfExport.lastExportResult !== null}
            />
            <ExportPdfButton
              disabled={!pdfExport.canExportFromUi || pdfExport.isExporting}
              isExporting={pdfExport.isExporting}
              onClick={() => {
                if (pdfExport.hasUnappliedConditionsWarning) {
                  setExportConfirmOpen(true);
                } else {
                  void pdfExport.exportPdf();
                }
              }}
            />
          </div>
        )}
        {currentStep === 1 && (
          <div className="sticky bottom-0 z-10 w-full border-t  px-6 py-4 bg-white shadow-sm flex flex-wrap min-w-0 items-center justify-end gap-4">
            <DrawStatusMessage
              drawBlocked={drawStatus.kind === 'blocked'}
              blockingMessage={
                drawStatus.blockingReasons[0]?.message ?? '抽選できません'
              }
              isCandidateShortageBlock={
                drawStatus.blockingReasons[0]?.code === 'draw-candidate-empty'
              }
              isNotDrawn={isNotDrawn}
              hasUnapplied={hasUnappliedDrawConditions}
              isDrawCompleted={isDrawn && !hasUnappliedDrawConditions}
            />
            <DrawButton
              onClick={model.stepTwo.executeDraw}
              disabled={!drawStatus.canDraw}
            />
          </div>
        )}
      </div>
      {/* JSON読込: isDirty 確認ダイアログ */}
      <BasicDialog
        open={loadJson.dialogState.isDirtyConfirmOpen}
        onOpenChange={(open) => {
          if (!open) loadJson.cancelProceed();
        }}
        title="出題条件を上書きしますか？"
        description="未反映の変更があります。JSONを読み込むと現在の設定が失われます。続行しますか？"
        primaryButtonText="続行"
        onClickPrimaryButton={loadJson.confirmProceed}
        secondaryButtonText="キャンセル"
        onClickSecondaryButton={loadJson.cancelProceed}
      />

      {/* JSON読込: エラーダイアログ */}
      <BasicDialog
        open={loadJson.dialogState.errorMessage !== null}
        onOpenChange={(open) => {
          if (!open) loadJson.closeError();
        }}
        title="読み込みエラー"
        description={loadJson.dialogState.errorMessage ?? ''}
        primaryButtonText="OK"
        onClickPrimaryButton={loadJson.closeError}
      />

      {/* JSON読込: 読み込み結果ダイアログ */}
      <BasicDialog
        open={loadJson.dialogState.isLoadSummaryOpen}
        onOpenChange={(open) => {
          if (!open) loadJson.closeLoadSummary();
        }}
        title="JSONを読み込みました"
        description={
          loadJson.dialogState.loadSummary
            ? [
                `読み込み形式: ${loadJson.dialogState.loadSummary.sourceType}`,
                `入力行数: ${loadJson.dialogState.loadSummary.inputRowCount}`,
                `復元行数: ${loadJson.dialogState.loadSummary.convertedRowCount}`,
                `失敗件数: ${loadJson.dialogState.loadSummary.failedRowCount}`,
                `自動調整件数: ${loadJson.dialogState.loadSummary.adjustedRowCount}`,
              ].join('\n')
            : ''
        }
        primaryButtonText="OK"
        onClickPrimaryButton={loadJson.closeLoadSummary}
      />

      {/* JSON読込: モード切替確認ダイアログ */}
      <BasicDialog
        open={loadJson.dialogState.isModeChangeConfirmOpen}
        onOpenChange={(open) => {
          if (!open) loadJson.cancelModeChange();
        }}
        title="作成モードを切り替えますか？"
        description="このJSONは問題集作成モード用です。問題集作成モードに切り替えて復元します。続行しますか？"
        primaryButtonText="続行"
        onClickPrimaryButton={loadJson.confirmModeChange}
        secondaryButtonText="キャンセル"
        onClickSecondaryButton={loadJson.cancelModeChange}
      />

      {/* 抽選実行後エラーダイアログ */}
      <BasicDialog
        open={model.stepTwo.drawErrorMessage !== null}
        onOpenChange={(open) => {
          if (!open) model.stepTwo.clearDrawErrorMessage();
        }}
        title="抽選に失敗しました"
        description={model.stepTwo.drawErrorMessage ?? ''}
        primaryButtonText="OK"
        onClickPrimaryButton={model.stepTwo.clearDrawErrorMessage}
      />
    </div>
  );
};

export default ExamPanel;

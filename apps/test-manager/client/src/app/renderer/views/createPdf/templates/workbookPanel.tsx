import BasicDialog from '@parts/basicDialog';
import { Separator } from '@ui/separator';
import { useLoadConditionJson } from '@views/createPdf/hooks/useLoadConditionJson';
import useWorkbookPanelModel from '@views/createPdf/hooks/useWorkbookPanelModel';
import useWorkbookPdfExport from '@views/createPdf/hooks/useWorkbookPdfExport';
import DifficultyAdjustment from '@views/createPdf/organisms/difficultyAdjustment';
import ExamYearFilter from '@views/createPdf/organisms/examYearFilter';
import ExportPdf from '@views/createPdf/organisms/exportPdf';
import JsonLoadButtons from '@views/createPdf/parts/jsonButtons';
import PreviewWindowReopenButton from '@views/createPdf/parts/previewWindowReopenButton';
import ResetButton from '@views/createPdf/parts/resetButton';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import StatusDot from '../../../components/parts/statusDot';
import BasicCondition from '../organisms/basicCondition';
import ExportPdfStatusMessage from '../organisms/exportPdfStatusMessage';
import GradeChangeDialog from '../organisms/gradeChangeDialog';
import OptionCondition from '../organisms/optionCondition';
import ResetConfirmDialog from '../organisms/resetConfirmDialog';
import WorkbookCategoryTableRow from '../organisms/workbookCategoryCondition';
import WorkbookQuestionFormat from '../organisms/workbookQuestionFormat';
import DrawButton from '../parts/drawButton';
import DrawStatusMessage from '../parts/drawStatusMessage';
import ExportPdfButton from '../parts/exportPdfButton';
import StepperButtons from '../parts/stepperButtons';
import useCreatePdfPreviewUpdateController from '../store/useCreatePdfPreviewUpdateController';

const WorkBookPanel = () => {
  const previewUpdate = useCreatePdfPreviewUpdateController('workbook');
  // BottomButtons 実装時に setCurrentStep を追加する
  const [currentStep, setCurrentStep] = useState<number>(1);
  const {
    hasUnappliedDrawConditions,
    isDrawn,
    isNotDrawn,
    drawStatus,
    exportStatusKind,
    previewStatusKind,
    previewReasons,
    exportBlockingReasons,
    exportWarningReasons,
  } = useCreatePdfStatusStore(
    useShallow((state) => ({
      hasUnappliedDrawConditions:
        state.drawConditionChangeStatus.hasUnappliedDrawConditions,
      isDrawn:
        state.drawConditionChangeStatus.lastAppliedDrawConditionKey !== null,
      isNotDrawn: state.drawConditionChangeStatus.kind === 'not-drawn',
      drawStatus: state.drawStatus,
      exportStatusKind: state.exportStatus.kind,
      previewStatusKind: state.previewStatus.kind,
      previewReasons: state.previewStatus.reasons,
      exportBlockingReasons: state.exportStatus.blockingReasons,
      exportWarningReasons: state.exportStatus.warningReasons,
    })),
  );
  const model = useWorkbookPanelModel({ previewUpdate });
  const pdfExport = useWorkbookPdfExport({
    stepThree: model.stepThree,
    previewUpdate,
  });
  const loadJson = useLoadConditionJson('workbook');
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

  const handleSetCurrentStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  return (
    <div
      className="bg-background relative w-full h-full flex flex-col min-w-0"
      style={{ scrollbarGutter: 'stable' }}
    >
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

      <div className="flex flex-col px-9 py-4 gap-4 flex-1 overflow-y-auto">
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
          open={model.dialogs.workbookModeChange.isOpen}
          title="問題形式を変更しますか？"
          description="問題形式を変更すると、カテゴリ条件と問題テーブルが初期化されます。続行しますか？"
          onConfirm={model.commands.confirmWorkbookModeChange}
          onCancel={model.commands.cancelWorkbookModeChange}
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
                  creationType="workbook"
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
                <WorkbookQuestionFormat
                  workbookMode={model.stepTwo.workbookMode}
                  setWorkbookMode={model.stepTwo.updateWorkbookMode}
                />
                <WorkbookCategoryTableRow
                  categoryTable={model.stepTwo.categoryTable}
                  categoryTreeBySubject={model.stepTwo.categoryTreeBySubject}
                  maxCountBySmallKey={model.stepTwo.maxCountBySmallKey}
                  selectedSubject={model.stepTwo.selectedSubject}
                  onSubjectChange={model.stepTwo.onSubjectChange}
                  onAddCondition={model.stepTwo.addCategoryCondition}
                  onAddConditions={model.stepTwo.addCategoryConditions}
                  onUpdateCondition={model.stepTwo.updateCategoryCondition}
                  onRemoveCondition={model.stepTwo.removeCategoryCondition}
                  onRemoveConditions={model.stepTwo.removeCategoryConditions}
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
              expectedFileNames={pdfExport.expectedFileNames}
              includeCover={model.stepThree.output.includeCover}
              isSelectingOutputDirectory={pdfExport.isSelectingOutputDirectory}
              lastExportedFiles={pdfExport.lastExportResult?.files}
              lastOutputFolderPath={
                pdfExport.lastExportResult?.outputFolderPath
              }
              onIncludeCoverChange={(v) =>
                model.stepThree.onOutputChange({ includeCover: v })
              }
              onSaveConditionJsonChange={(v) =>
                model.stepThree.onOutputChange({ saveConditionJson: v })
              }
              onSelectOutputDirectory={() => {
                void pdfExport.selectOutputDirectory();
              }}
              outputDirectory={pdfExport.outputDirectory}
              saveConditionJson={model.stepThree.output.saveConditionJson}
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
              // model.stepTwo.drawErrorMessage ?? '抽選できません'
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
        description="このJSONは模擬試験作成モード用です。模擬試験作成モードに切り替えて復元します。続行しますか？"
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

export default WorkBookPanel;

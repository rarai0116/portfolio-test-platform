import useExamPanelModel from '@views/createPdf/hooks/useExamPanelModel';
import useExamPdfExport from '@views/createPdf/hooks/useExamPdfExport';
import BasicCondition from '@views/createPdf/organisms/basicCondition';
import ExportPdf from '@views/createPdf/organisms/exportPdf';
import OptionCondition from '@views/createPdf/organisms/optionCondition';
import PreviewUpdateStatus from '@views/createPdf/parts/previewUpdateStatus';
import useCreatePdfPreviewUpdateController from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';

const TempExamPanel = () => {
  const previewUpdate = useCreatePdfPreviewUpdateController('exam');
  const model = useExamPanelModel({ previewUpdate });
  const tableSections = useTestTableStore((s) => s.sections);
  const hasUnappliedDrawConditions = useCreatePdfStatusStore(
    (state) => state.drawConditionChangeStatus.hasUnappliedDrawConditions,
  );
  const pdfExport = useExamPdfExport({
    stepThree: model.stepThree,
    previewUpdate,
    subjects: tableSections.map((section) => section.label),
  });

  return (
    <div className="h-full overflow-auto bg-background p-4">
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">モック用プレビュー更新</h2>
          <PreviewUpdateStatus
            onManualCommit={pdfExport.requestManualCommit}
            status={previewUpdate}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">基本条件</h2>
          <BasicCondition
            grade={model.stepOne.basic.grade}
            title={model.stepOne.basic.title}
            creationType="exam"
            onTitleEditEnd={previewUpdate.endGuardedEdit}
            onTitleEditStart={previewUpdate.beginGuardedEdit}
            onTitleChange={model.stepOne.onTitleChange}
            onGradeChange={model.stepOne.onRequestGradeChange}
          />
          <p className="text-sm text-muted-foreground">
            未反映状態: {hasUnappliedDrawConditions ? 'あり' : 'なし'}
          </p>
        </section>

        {model.dialogs.gradeChange.isOpen && (
          <div className="rounded border border-yellow-400 bg-yellow-50 p-4 text-sm">
            <p className="mb-3">
              級を{model.dialogs.gradeChange.pendingGrade}
              級に変更すると、出題条件・問題テーブルが初期化されます。続行しますか？
            </p>
            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={model.commands.confirmGradeChange}
                type="button"
              >
                続行
              </button>
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={model.commands.cancelGradeChange}
                type="button"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-base font-semibold">模擬試験モードの条件入力</h2>

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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">枠条件</h3>
              <button
                className="rounded border px-3 py-1 text-sm"
                disabled={model.stepTwo.isLoadingTestData}
                onClick={model.stepTwo.addCategoryTableRow}
                type="button"
              >
                {model.stepTwo.isLoadingTestData
                  ? '問題データ読込中...'
                  : '枠条件を追加（T35/T36）'}
              </button>
            </div>

            {model.stepTwo.categoryTable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだ枠条件はありません。
              </p>
            ) : (
              <div className="space-y-2">
                {model.stepTwo.categoryTable.map((condition) => (
                  <div
                    className="flex items-center justify-between rounded border p-3 text-sm"
                    key={condition.id}
                  >
                    <span className="text-muted-foreground">
                      {condition.subject ?? '（学科未設定）'}
                    </span>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={() =>
                        model.stepTwo.removeCategoryTableRow(condition.id)
                      }
                      type="button"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tableSections.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">学科テーブル</h3>
              <div className="space-y-2">
                {tableSections.map((section) => (
                  <div className="rounded border p-3" key={section.id}>
                    <p className="text-sm font-medium">{section.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      行数: {section.rows.length}
                    </p>
                    {section.shortageCount != null &&
                      section.shortageCount > 0 && (
                        <p className="mt-1 text-sm text-amber-700">
                          候補不足: {section.shortageCount}問
                        </p>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h2 className="text-base font-semibold">PDF出力</h2>
            <ExportPdf
              blockingReasons={pdfExport.blockingReasons}
              //              canExport={pdfExport.canExportFromUi}
              errorMessage={pdfExport.errorMessage}
              expectedFileNames={pdfExport.expectedFileNames}
              //              isExporting={pdfExport.isExporting}
              isSelectingOutputDirectory={pdfExport.isSelectingOutputDirectory}
              lastExportedFiles={pdfExport.lastExportResult?.files}
              lastOutputFolderPath={
                pdfExport.lastExportResult?.outputFolderPath
              }
              /*              onExport={() => {
                void pdfExport.exportPdf();
              }}
*/
              onSelectOutputDirectory={() => {
                void pdfExport.selectOutputDirectory();
              }}
              outputDirectory={pdfExport.outputDirectory}
              warningMessages={pdfExport.warningMessages}
            />
          </section>
        </section>
      </div>
    </div>
  );
};

export default TempExamPanel;

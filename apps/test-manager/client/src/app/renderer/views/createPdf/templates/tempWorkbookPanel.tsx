import { Input } from '@renderer/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radioGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Button } from '@ui/button';
import { Label } from '@ui/label';
import { WORKBOOK_MOCK_SUBJECTS_BY_GRADE } from '@views/createPdf/api/workbookMockTable';
import useTempWorkbookPanelModel from '@views/createPdf/hooks/useTempWorkbookPanelModel';
import useWorkbookPdfExport from '@views/createPdf/hooks/useWorkbookPdfExport';
import BasicCondition from '@views/createPdf/organisms/basicCondition';
import ExportPdf from '@views/createPdf/organisms/exportPdf';
import PreviewUpdateStatus from '@views/createPdf/parts/previewUpdateStatus';
import useCreatePdfPreviewUpdateController from '@views/createPdf/store/useCreatePdfPreviewUpdateController';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import { useId } from 'react';

const TempWorkbookPanel = () => {
  const previewUpdate = useCreatePdfPreviewUpdateController('workbook');
  const model = useTempWorkbookPanelModel({ previewUpdate });
  const hasUnappliedDrawConditions = useCreatePdfStatusStore(
    (state) => state.drawConditionChangeStatus.hasUnappliedDrawConditions,
  );
  const tableRowCount = useTestTableStore(
    (s) => s.sections[0]?.rows.length ?? 0,
  );
  const pdfExport = useWorkbookPdfExport({
    stepThree: model.stepThree,
    previewUpdate,
  });
  const qaaId = useId();
  const qaaAllTrueId = useId();
  const qaaAllFalseId = useId();
  const multipleChoiceId = useId();
  const availableSubjects =
    WORKBOOK_MOCK_SUBJECTS_BY_GRADE[model.stepOne.basic.grade];

  return (
    <div className="h-full overflow-auto bg-background p-4">
      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            問題集モックのプレビュー更新
          </h2>
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
            creationType="workbook"
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
          <div className="space-y-2">
            <h2 className="text-base font-semibold">問題形式</h2>
            <RadioGroup
              className="space-y-2"
              value={model.stepTwo.workbookMode}
              onValueChange={(value) =>
                model.stepTwo.updateWorkbookMode(
                  value as
                    | 'qaa'
                    | 'qaaAllTrue'
                    | 'qaaAllFalse'
                    | 'multipleChoice',
                )
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="qaa" id={qaaId} />
                <Label htmlFor={qaaId}>一問一答</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="qaaAllTrue" id={qaaAllTrueId} />
                <Label htmlFor={qaaAllTrueId}>一問一答（全て◯）</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="qaaAllFalse" id={qaaAllFalseId} />
                <Label htmlFor={qaaAllFalseId}>一問一答（全て×）</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="multipleChoice" id={multipleChoiceId} />
                <Label htmlFor={multipleChoiceId}>選択問題</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                学科別ランダム抽選条件
              </h2>
              <Button
                disabled={
                  model.stepTwo.categoryTable.length >= availableSubjects.length
                }
                onClick={model.stepTwo.addCategoryCondition}
                size="sm"
                variant="outline"
              >
                行を追加
              </Button>
            </div>

            {model.stepTwo.categoryTable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                まだ学科条件はありません。
              </p>
            ) : (
              <div className="space-y-3">
                {model.stepTwo.categoryTable.map((condition) => {
                  const selectedSubjects = new Set(
                    model.stepTwo.categoryTable
                      .filter((item) => item.id !== condition.id)
                      .flatMap((item) => (item.subject ? [item.subject] : [])),
                  );
                  const selectableSubjects = availableSubjects.filter(
                    (subject) =>
                      subject === condition.subject ||
                      !selectedSubjects.has(subject),
                  );

                  return (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-3 rounded border p-3"
                      key={condition.id}
                    >
                      <div className="space-y-1">
                        <Label>学科</Label>
                        <Select
                          value={condition.subject ?? ''}
                          onValueChange={(value) => {
                            model.stepTwo.updateCategoryCondition(
                              condition.id,
                              (current) => ({
                                ...current,
                                subject: value,
                              }),
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="学科を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectableSubjects.map((subject) => (
                              <SelectItem key={subject} value={subject}>
                                {subject}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>件数</Label>
                        <Input
                          min={1}
                          type="number"
                          value={String(condition.count)}
                          onChange={(event) => {
                            const nextCount = Math.max(
                              1,
                              Number(event.target.value || '1'),
                            );
                            model.stepTwo.updateCategoryCondition(
                              condition.id,
                              (current) => ({
                                ...current,
                                count: nextCount,
                              }),
                            );
                          }}
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          onClick={() =>
                            model.stepTwo.removeCategoryCondition(condition.id)
                          }
                          size="sm"
                          variant="outline"
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                disabled={
                  model.stepTwo.isLoadingTestData ||
                  model.stepTwo.categoryTable.length === 0
                }
                onClick={model.stepTwo.generateTable}
                size="sm"
                variant="outline"
              >
                {model.stepTwo.isLoadingTestData
                  ? '問題データ読込中...'
                  : '問題テーブルを生成'}
              </Button>
              <span className="text-sm text-muted-foreground">
                行数: {tableRowCount}
              </span>
            </div>
          </div>

          {model.stepTwo.summaries.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">生成結果サマリ</h2>
              <div className="space-y-2">
                {model.stepTwo.summaries.map((summary) => (
                  <div
                    className="rounded border p-3 text-sm"
                    key={summary.conditionId}
                  >
                    <div className="font-medium">
                      {summary.subject ?? '（学科未設定）'}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      requested: {summary.requestedCount} / actual:{' '}
                      {summary.actualCount} / shortage: {summary.shortageCount}
                    </div>
                  </div>
                ))}
              </div>
            </section>
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

export default TempWorkbookPanel;

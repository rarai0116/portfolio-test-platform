import type { TestSubject } from '@shared/types/contracts';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import useTestTablePanelModel from '../hooks/useTestTablePanelModel';
import ExamTestTable from '../organisms/examTestTable';
import useCreatePdfViewStore from '../store/useCreatePdfViewStore';
import useTestTableStore from '../store/useTestTableStore';
import type { ExamSubjectForUI } from '../types/panelModel';

/**
 * 問題テーブルパネルテンプレート。
 * workbook / exam 共通で useTestTableStore を参照し、ExamTestTable で表示する。
 */
const TestTablePanel = () => {
  const {
    sections,
    settings,
    updateRow,
    isShuffleChoices,
    testDataByNo,
    candidateIndex,
    rowStatuses,
  } = useTestTablePanelModel();
  const { creationType, grade } = useCreatePdfViewStore(
    useShallow((s) => ({ creationType: s.creationType, grade: s.grade })),
  );
  // workbook モードのみ抽選後に表示。exam は初期から常に表示
  const isDrawn = useTestTableStore(
    (s) => s.lastAppliedDrawConditionKey !== null,
  );
  const rowCount = sections.reduce(
    (sum, section) => sum + section.rows.length,
    0,
  );
  const hasAnyDrawnRow = sections.some((s) =>
    s.rows.some((r) => r.selectedNo !== null),
  );
  const showTable =
    creationType === 'exam' ? hasAnyDrawnRow : isDrawn || rowCount > 0;

  // sections の label から sectionNames を動的に構成する（exam の場合 label は TestSubject と一致する前提）
  const sectionNames: ExamSubjectForUI[] = useMemo(
    () =>
      sections.map((section, i) => ({
        id: `section-${i}`,
        label: section.label as TestSubject,
        count: section.rows.length,
      })),
    [sections],
  );

  return (
    <div
      className="h-full flex flex-col gap-3 px-9 py-6 overflow-x-auto bg-background"
      style={{ scrollbarGutter: 'stable' }}
    >
      {!showTable ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          抽選を実行すると、ここに問題テーブルが表示されます
        </div>
      ) : (
        <ExamTestTable
          sectionNames={sectionNames}
          tableSections={sections}
          showQaaChoiceIndex={settings.showQaaChoiceIndex}
          grade={grade}
          isShuffleChoices={isShuffleChoices}
          testDataByNo={testDataByNo}
          candidateIndex={candidateIndex}
          rowStatuses={rowStatuses}
          onRowChange={updateRow}
        />
      )}
    </div>
  );
};

export default TestTablePanel;

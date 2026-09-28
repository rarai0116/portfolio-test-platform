import type { TestData } from '@shared/types/contracts';
import {
  calcQaaAnswerBool,
  normalizeQaaChoiceIndex,
} from '@views/createPdf/api/candidateIndex';
import type { CreatePdfTestTableRowMarker } from '@views/createPdf/types/statusState';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

type DeriveTestTableRowAlertsParams = {
  row: TestTableRow;
  testDataByNo: ReadonlyMap<number, TestData>;
  selectedYearNos: ReadonlySet<number> | null;
  excludedTagIds: readonly string[];
  workbookMode: WorkbookMode | null;
  showQaaChoiceIndex: boolean;
};

export const deriveTestTableRowAlerts = ({
  row,
  testDataByNo,
  selectedYearNos,
  excludedTagIds,
  workbookMode,
  showQaaChoiceIndex,
}: DeriveTestTableRowAlertsParams): CreatePdfTestTableRowMarker[] => {
  if (!row.isFixed || row.selectedNo === null) return [];

  const selectedNo = Number(row.selectedNo);
  const testData = testDataByNo.get(selectedNo);
  if (testData === undefined) return [];

  const markers: CreatePdfTestTableRowMarker[] = [];

  if (selectedYearNos !== null && !selectedYearNos.has(selectedNo)) {
    markers.push({
      code: 'fixed-year-out-of-condition',
      severity: 'warning',
      targetCell: 'no',
      message: `No.${row.selectedNo} は出題年フィルタの対象外です。`,
    });
  }

  const assignedCondition = row.categoryTable[0];
  if (
    assignedCondition !== undefined &&
    (testData.bigCategoryTag !== assignedCondition.bigCategoryTag ||
      testData.smallCategoryTag !== assignedCondition.smallCategoryTag)
  ) {
    markers.push({
      code: 'fixed-category-out-of-condition',
      severity: 'warning',
      targetCell: 'category',
      message: `No.${row.selectedNo} は指定カテゴリと異なるカテゴリの問題です。`,
    });
  }

  const excludedTagSet = new Set(excludedTagIds);
  const matchedExcludedTags =
    testData.otherTags?.filter((tag) => excludedTagSet.has(tag)) ?? [];
  if (matchedExcludedTags.length > 0) {
    markers.push({
      code: 'fixed-excluded-tag',
      severity: 'warning',
      targetCell: 'no',
      message: `No.${row.selectedNo} は除外タグ条件に該当しています。`,
    });
  }

  const qaaChoiceIndex = normalizeQaaChoiceIndex(row.qaaChoiceIndex);

  if (
    showQaaChoiceIndex &&
    qaaChoiceIndex !== null &&
    (workbookMode === 'qaaAllTrue' || workbookMode === 'qaaAllFalse')
  ) {
    const answerBool = calcQaaAnswerBool(testData, qaaChoiceIndex);
    const mismatched =
      (workbookMode === 'qaaAllTrue' && !answerBool) ||
      (workbookMode === 'qaaAllFalse' && answerBool);
    if (mismatched) {
      markers.push({
        code: 'fixed-qaa-condition-mismatch',
        severity: 'warning',
        targetCell: 'choice',
        message: `No.${row.selectedNo} の固定選択肢は一問一答条件と一致していません。`,
      });
    }
  }

  return markers;
};

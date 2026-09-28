import type { TestData } from '@shared/types/contracts';
import {
  calcQaaAnswerBool,
  normalizeQaaChoiceIndex,
  toCandidateKey,
} from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type { CreatePdfDifficultyDraftState } from '@views/createPdf/types/draftState';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

export type CreatePdfDrawValidationErrorCode =
  | 'row-count-mismatch'
  | 'duplicate-question'
  | 'category-mismatch'
  | 'difficulty-mismatch'
  | 'qaa-condition-mismatch';

export type CreatePdfDrawValidationError = {
  code: CreatePdfDrawValidationErrorCode;
  message: string;
  rowId?: string;
  slotId?: string;
};

type ValidateDrawResultParams = {
  slots: readonly DrawSlot[];
  rows: readonly TestTableRow[];
  testDataByNo: ReadonlyMap<number, TestData>;
  difficulty: CreatePdfDifficultyDraftState;
  workbookMode?: WorkbookMode;
};

export const validateDrawResult = ({
  slots,
  rows,
  testDataByNo,
  difficulty,
  workbookMode,
}: ValidateDrawResultParams): CreatePdfDrawValidationError[] => {
  const errors: CreatePdfDrawValidationError[] = [];

  if (rows.length !== slots.length) {
    errors.push({
      code: 'row-count-mismatch',
      message: '抽選結果の行数が要求スロット数と一致していません。',
    });
  }

  const seenKeys = new Map<string, boolean>();
  const actualDifficultyCounts: [number, number, number] = [0, 0, 0];

  rows.forEach((row, index) => {
    if (row.selectedNo === null) return;
    const selectedNo = Number(row.selectedNo);
    const testData = testDataByNo.get(selectedNo);
    if (testData === undefined) return;

    const qaaChoiceIndex = normalizeQaaChoiceIndex(row.qaaChoiceIndex);
    const candidateKey = toCandidateKey(selectedNo, qaaChoiceIndex);
    if (seenKeys.has(candidateKey)) {
      const firstWasFixed = seenKeys.get(candidateKey) === true;
      if (!(row.isFixed && firstWasFixed)) {
        errors.push({
          code: 'duplicate-question',
          message: `No.${row.selectedNo} が抽選結果内で重複しています。`,
          rowId: row.id,
          slotId: slots[index]?.id,
        });
      }
    } else {
      seenKeys.set(candidateKey, row.isFixed);
    }

    const diffIdx = Number(testData.difficult) - 1;
    if (diffIdx >= 0 && diffIdx <= 2) actualDifficultyCounts[diffIdx]++;

    const slot = slots[index];
    if (slot && !row.isFixed && slot.conditions.length > 0) {
      const matched = slot.conditions.some(
        (condition) =>
          testData.subject === slot.subject &&
          testData.bigCategoryTag === condition.big &&
          testData.smallCategoryTag === condition.small,
      );
      if (!matched) {
        errors.push({
          code: 'category-mismatch',
          message: `No.${row.selectedNo} は割り当てスロットのカテゴリ条件を満たしていません。`,
          rowId: row.id,
          slotId: slot.id,
        });
      }
    }

    if (
      !row.isFixed &&
      qaaChoiceIndex !== null &&
      (workbookMode === 'qaaAllTrue' || workbookMode === 'qaaAllFalse')
    ) {
      const answerBool = calcQaaAnswerBool(testData, qaaChoiceIndex);
      const mismatched =
        (workbookMode === 'qaaAllTrue' && !answerBool) ||
        (workbookMode === 'qaaAllFalse' && answerBool);
      if (mismatched) {
        errors.push({
          code: 'qaa-condition-mismatch',
          message: `No.${row.selectedNo} は一問一答条件を満たしていません。`,
          rowId: row.id,
          slotId: slot?.id,
        });
      }
    }
  });

  if (difficulty.isCalculated) {
    const expected = difficulty.entityCount;
    if (
      expected[0] !== actualDifficultyCounts[0] ||
      expected[1] !== actualDifficultyCounts[1] ||
      expected[2] !== actualDifficultyCounts[2]
    ) {
      errors.push({
        code: 'difficulty-mismatch',
        message: '抽選結果の難易度別件数が指定条件と一致していません。',
      });
    }
  }

  return errors;
};

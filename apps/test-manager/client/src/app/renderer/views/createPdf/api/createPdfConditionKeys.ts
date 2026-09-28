import type {
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
  ExamState,
  WorkbookState,
} from '@views/createPdf/types/draftState';
import type {
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';

const normalizeOptions = (opts: CreatePdfCommonOptionDraftState) => ({
  // タグは順不同の集合なので sort して比較する
  excludedTagIds: [...opts.excludedTagIds].sort(),
  excludePastExam: opts.excludePastExam,
  excludeOriginal: opts.excludeOriginal,
  isShuffleChoices: opts.isShuffleChoices,
  shuffleSeed: opts.shuffleSeed,
});

const normalizeDifficulty = (d: CreatePdfDifficultyDraftState) => ({
  // isEnabled 廃止につき除去
  isCalculated: d.isCalculated,
  ratios: d.ratios,
  // settableDifficultyRanges は計算キャッシュなので dirty 判定キーから除外
});

type WorkbookDrawConditionKeyInput = Pick<WorkbookState, 'basic' | 'stepTwo'> &
  Partial<Pick<WorkbookState, 'stepThree'>>;

type ExamDrawConditionKeyInput = Pick<ExamState, 'basic' | 'stepTwo'> &
  Partial<Pick<ExamState, 'stepThree'>>;

/**
 * workbook の抽選条件比較キーを生成する。
 * markDirty の代替として、未反映状態の導出に使用する。
 */
export const createWorkbookDrawConditionKey = (
  draft: WorkbookDrawConditionKeyInput,
): string =>
  JSON.stringify({
    grade: draft.basic.grade,
    selectedYears: draft.basic.selectedYears,
    workbookMode: draft.stepTwo.workbookMode,
    options: normalizeOptions(draft.stepTwo.options),
    difficulty: normalizeDifficulty(draft.stepTwo.difficulty),
    categoryTable: draft.stepTwo.categoryTable,
  });

export const createWorkbookTableKey = (rows: TestTableRow[]): string =>
  JSON.stringify(rows);

/**
 * exam の抽選条件比較キーを生成する。
 */
export const createExamDrawConditionKey = (
  draft: ExamDrawConditionKeyInput,
): string =>
  JSON.stringify({
    grade: draft.basic.grade,
    selectedYears: draft.basic.selectedYears,
    options: normalizeOptions(draft.stepTwo.options),
    difficulty: normalizeDifficulty(draft.stepTwo.difficulty),
    categoryTable: draft.stepTwo.categoryTable,
  });

export const createExamTableKey = (sections: TestTableSection[]): string =>
  JSON.stringify(sections);

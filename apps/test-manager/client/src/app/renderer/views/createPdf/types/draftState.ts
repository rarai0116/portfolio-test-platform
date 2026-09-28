import type { TestSubject } from '@shared/types/contracts';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import type { WorkbookCategoryTableRow, WorkbookMode } from './viewState';

export type CreatePdfBasicDraftState = {
  grade: 1 | 2;
  title: string;
  /** null = 全年対象（フィルタなし）。初期値・旧JSON復元時も null。 */
  selectedYears: string[] | null;
};

export type CreatePdfOutputDraftState = {
  selectedOutputFolder: string | null;
  includeCover: boolean;
  excludeMiddleCover: boolean;
  saveConditionJson: boolean;
  examDate?: ExamDateOption;
};

export type CreatePdfCommonOptionDraftState = {
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
};

export type DifficultyRange = {
  min: number; // 設定可能な最小割合（%）
  max: number; // 設定可能な最大割合（%）
};

export type CreatePdfDifficultyDraftState = {
  // isEnabled 廃止: isCalculated が活性状態を兼ねる
  isCalculated: boolean;
  ratios: [number, number];
  entityCount: [number, number, number]; // 各難易度の問題数。順番は「⭐︎」「⭐︎⭐︎」「⭐︎⭐︎⭐︎」
  // 計算キャッシュ: isCalculated=true のときのみ有効。dirty判定・保存対象外
  settableDifficultyRanges:
    | [DifficultyRange, DifficultyRange, DifficultyRange]
    | null;
};

/** exam のカテゴリ OR 条件の1候補。 */
export type CategoryCondition = {
  big: string;
  small: string | null;
};

/** exam の条件枠型 */
export type ExamCategoryTableRow = {
  id: string;
  subject: TestSubject; // 行追加時に確定済み（null 不可）
  categoryConditions: CategoryCondition[]; // OR 条件の複数候補。空 = 条件なし
};

export type WorkbookStepTwoState = {
  workbookMode: WorkbookMode;
  options: CreatePdfCommonOptionDraftState;
  difficulty: CreatePdfDifficultyDraftState;
  categoryTable: WorkbookCategoryTableRow[];
};

export type WorkbookState = {
  basic: CreatePdfBasicDraftState;
  stepTwo: WorkbookStepTwoState;
  stepThree: CreatePdfOutputDraftState;
};

export type ExamStepTwoState = {
  options: CreatePdfCommonOptionDraftState;
  difficulty: CreatePdfDifficultyDraftState;
  categoryTable: ExamCategoryTableRow[];
};

export type ExamState = {
  basic: CreatePdfBasicDraftState;
  stepTwo: ExamStepTwoState;
  stepThree: CreatePdfOutputDraftState;
};

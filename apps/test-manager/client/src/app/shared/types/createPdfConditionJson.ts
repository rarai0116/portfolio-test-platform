/** 出題条件JSON スキーマ型定義 (T26) */

export type ConditionJsonVersion = 1;

export type SelectedReference = {
  nengo: string | null;
  year: string | null;
  subject: string | null;
  no: string;
  isOriginal: boolean;
  publicationYear: string | null;
  publicationNo: string | null;
};

export type ConditionJsonCategoryPair = {
  big: string | null;
  small: string | null;
};

export type ExamDateOption = {
  year: string;
  month: string;
  day: string;
};

// 問題集モード用

export type WorkbookConditionRow = {
  id: string;
  subject: string | null;
  bigCategoryTag: string | null;
  smallCategoryTag: string | null;
  count: number;
};

export type WorkbookTableRow = {
  id: string;
  /** 対応する条件行ID。手動配置・条件なし行は null */
  sourceConditionId: string | null;
  categoryPairs: ConditionJsonCategoryPair[];
  selectedNo: string | null;
  selectedUuid: string | null;
  selectedReference: SelectedReference | null;
  /** 一問一答選択肢番号。1始まり。0はnullと同等に扱う。 */
  qaaChoiceIndex: number | null;
  isFixed: boolean;
  pageBreakBefore: boolean;
};

export type WorkbookConditionJson = {
  version: ConditionJsonVersion;
  creationType: 'workbook';
  gradeId: 1 | 2;
  title: string;
  createdAt: string;
  shuffleSeed: number | null;
  mode: 'qaa' | 'qaaAllTrue' | 'qaaAllFalse' | 'multipleChoice';
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isChoiceShuffle: boolean;
  difficulty: {
    isEnabled: boolean;
    ratios: [number, number];
  };
  selectedOutputFolder?: string | null;
  /** null = 全年対象。省略または null → 全年対象として復元。 */
  selectedYears?: string[] | null;
  /** 省略時は mode から復元時に補完する。 */
  showQaaChoiceIndex?: boolean;
  conditions: WorkbookConditionRow[];
  table: WorkbookTableRow[];
};

// 模擬試験モード用

export type ExamSlotRow = {
  id: string;
  subject: string;
  categoryPairs: ConditionJsonCategoryPair[];
  isFixed: boolean;
  pageBreakBefore: boolean;
  selectedNo: string | null;
  selectedUuid: string | null;
  selectedReference: SelectedReference | null;
};

export type ExamConditionJson = {
  version: ConditionJsonVersion;
  creationType: 'exam';
  gradeId: 1 | 2;
  title: string;
  createdAt: string;
  shuffleSeed: number | null;
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isChoiceShuffle: boolean;
  difficulty: {
    isEnabled: boolean;
    ratios: [number, number];
  };
  selectedOutputFolder?: string | null;
  /** null = 全年対象。省略または null → 全年対象として復元。 */
  selectedYears?: string[] | null;
  /** 省略時は従来互換として false。 */
  showQaaChoiceIndex?: boolean;
  /** 省略時は年度・月・日すべて空文字として復元する。 */
  examDate?: ExamDateOption;
  slots: ExamSlotRow[];
};

export type CreatePdfConditionJson = WorkbookConditionJson | ExamConditionJson;

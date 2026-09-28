import type { TestSubject } from '@shared/types/contracts';

// 両モードで共有するカテゴリ条件の最小単位。
export type TestCategoryCondition = {
  id: string;
  subject: string | null;
  bigCategoryTag: string | null;
  smallCategoryTag: string | null;
};

// 両モードで共通に扱う問題テーブル行の基底型。
export type TestTableRow = {
  id: string;
  sourceConditionId: string | null;
  categoryTable: TestCategoryCondition[];
  selectedNo: string | null;
  qaaChoiceIndex: number | null;
  isFixed: boolean;
  pageBreakBefore: boolean;
  hasError: boolean;
  errorMessage: string | null;
};

// 問題テーブルのセクション分割モード。
export type TestTableSectionMode =
  | 'by-subject' // exam: 学科タブ単位
  | 'single' // workbook: 単一セクション
  | 'by-small-category'; // 将来: 小分類単位

// 問題テーブルの列表示設定。sectionMode とは独立して管理する。
export type TestTableSettings = {
  showQaaChoiceIndex: boolean;
};

export type TestTableSectionSubject = TestSubject | 'all';

export const DEFAULT_TEST_TABLE_SECTION_SUBJECT: TestSubject = '学科Ⅰ';

// 模擬試験の学科単位や、将来のグループ単位を表す共通セクション。
export type TestTableSection = {
  id: string;
  label: string;
  /** 問題テーブル単位の対象学科。label は表示名であり判定の正本にしない。 */
  subject?: TestTableSectionSubject;
  rows: TestTableRow[];
  /** 仮テーブルモック: 候補不足で生成できなかった行数。T35/T36 で削除する */
  shortageCount?: number;
};

/** captureRouteSnapshot 用のテーブルストア状態スナップショット（actions を除く）。 */
export type TestTableStoreSnapshot = {
  sections: TestTableSection[];
  sectionMode: TestTableSectionMode;
  settings: TestTableSettings;
  lastAppliedDrawConditionKey: string | null;
  lastSavedOrRestoredTableKey: string | null;
};

import { replaceTestTableRow } from '@views/createPdf/api/testTableRows';
import type {
  TestTableRow,
  TestTableSection,
  TestTableSectionMode,
  TestTableSettings,
  TestTableStoreSnapshot,
} from '@views/createPdf/types/testTable';
import { create } from 'zustand';

type ApplyDrawResultPayload = {
  sections: TestTableSection[];
  /** applyDrawResult 呼び出し時に条件テーブル側で生成したキー */
  drawConditionKey: string;
};

type TestTableStore = TestTableStoreSnapshot & {
  actions: {
    /** 抽選実行結果を問題テーブル全体として差し替え、drawConditionKey を更新する */
    applyDrawResult: (payload: ApplyDrawResultPayload) => void;
    /** 手動入力（1行単位の更新）。sectionId + rowId で特定 */
    updateRow: (
      sectionId: string,
      rowId: string,
      patch: Partial<
        Pick<
          TestTableRow,
          'selectedNo' | 'qaaChoiceIndex' | 'isFixed' | 'pageBreakBefore'
        >
      >,
    ) => void;
    /** セクションモードを設定（モード切替時） */
    setSectionMode: (mode: TestTableSectionMode) => void;
    /** テーブル設定を個別に更新（モード切替時） */
    setSettings: (patch: Partial<TestTableSettings>) => void;
    /** リセット */
    reset: () => void;
    /** ルートスナップショット復元時の一括差し替え */
    replaceSections: (sections: TestTableSection[], tableKey: string) => void;
  };
};

const INITIAL_STATE: TestTableStoreSnapshot = {
  sections: [],
  sectionMode: 'single',
  settings: { showQaaChoiceIndex: false },
  lastAppliedDrawConditionKey: null,
  lastSavedOrRestoredTableKey: null,
};

const useTestTableStore = create<TestTableStore>((set) => ({
  ...INITIAL_STATE,
  actions: {
    applyDrawResult: ({ sections, drawConditionKey }) =>
      set({
        sections,
        lastAppliedDrawConditionKey: drawConditionKey,
        // 抽選直後は「保存済み」状態とみなす（テーブル内容 JSON を起点とする）
        lastSavedOrRestoredTableKey: JSON.stringify(sections),
      }),

    updateRow: (sectionId, rowId, patch) =>
      set((state) => ({
        sections: state.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                rows: replaceTestTableRow(section.rows, rowId, (row) => ({
                  ...row,
                  ...patch,
                })),
              },
        ),
      })),

    setSectionMode: (mode) => set({ sectionMode: mode }),

    setSettings: (patch) =>
      set((state) => ({ settings: { ...state.settings, ...patch } })),

    reset: () => set(INITIAL_STATE),

    replaceSections: (sections, tableKey) =>
      set({
        sections,
        lastSavedOrRestoredTableKey: tableKey,
      }),
  },
}));

export default useTestTableStore;

import type {
  WorkbookViewState,
  WorkbookViewValues,
} from '@views/createPdf/types/viewState';
import { create } from 'zustand';

export const createInitialWorkbookViewState = (): WorkbookViewValues => ({
  // 問題集モードの出題形式。
  workbookMode: 'qaa',
  // 候補から除外するタグ一覧。
  excludedTagIds: [],
  // 過去問を候補から外すかどうか。
  excludePastExam: false,
  // オリジナル問題を候補から外すかどうか。
  excludeOriginal: false,
  // 選択問題でシャッフルを有効にするかどうか。
  isShuffleChoices: false,
  // プレビューと PDF を整合させるための seed。
  shuffleSeed: null,
  // JSON 復元時のモード分岐。
  restoreMode: null,
  // 初期テーブル生成の条件行。
  categoryTable: [],
  // 共通問題テーブルの正本。
  tableRows: [],
});

const useWorkbookViewStore = create<WorkbookViewState>((set) => ({
  ...createInitialWorkbookViewState(),
  actions: {
    setWorkbookMode: (value) => set({ workbookMode: value }),
    setExcludedTagIds: (value) => set({ excludedTagIds: value }),
    setExcludePastExam: (value) => set({ excludePastExam: value }),
    setExcludeOriginal: (value) => set({ excludeOriginal: value }),
    setShuffleChoices: (value) => set({ isShuffleChoices: value }),
    setShuffleSeed: (value) => set({ shuffleSeed: value }),
    setRestoreMode: (value) => set({ restoreMode: value }),
    replaceCategoryConditions: (value) => set({ categoryTable: value }),
    replaceTableRows: (value) => set({ tableRows: value }),
    reset: () => set(createInitialWorkbookViewState()),
  },
}));

export default useWorkbookViewStore;

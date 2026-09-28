import type {
  CreatePdfCommonState,
  CreatePdfPreviewIssue,
  CreatePdfViewState,
  CreationType,
} from '@views/createPdf/types/viewState';
import { create } from 'zustand';

const upsertIssue = (
  issues: CreatePdfPreviewIssue[],
  nextIssue: CreatePdfPreviewIssue,
) => {
  const nextIssues = issues.filter((issue) => issue.id !== nextIssue.id);
  nextIssues.push(nextIssue);
  return nextIssues;
};

export const createInitialCreatePdfViewState = (
  creationType: CreationType = 'exam',
): CreatePdfCommonState => ({
  // 現在どちらの作成画面を表示するかの正本。
  creationType,
  // 問題データ取得元を切り替える級指定。
  grade: 1,
  // 表紙・出力・プレビューに共有されるタイトル。
  title: '',
  // 出力先候補。未選択時は null を許容する。
  selectedOutputFolder: null,
  // 条件変更が問題テーブルへ未反映かどうかを示す。
  isDirtyConditions: false,
});

const useCreatePdfViewStore = create<CreatePdfViewState>((set) => ({
  ...createInitialCreatePdfViewState(),
  currentPreviewState: null,
  actions: {
    setCreationType: (value) => set({ creationType: value }),
    setGrade: (value) => set({ grade: value }),
    setTitle: (value) => set({ title: value }),
    setSelectedOutputFolder: (value) => set({ selectedOutputFolder: value }),
    markDirty: () => set({ isDirtyConditions: true }),
    clearDirty: () => set({ isDirtyConditions: false }),
    setCurrentPreviewState: (value) => set({ currentPreviewState: value }),
    replacePreviewIssues: (issues) =>
      set((state) => ({
        currentPreviewState: state.currentPreviewState
          ? { ...state.currentPreviewState, issues }
          : null,
      })),
    upsertPreviewIssue: (issue) =>
      set((state) => ({
        currentPreviewState: state.currentPreviewState
          ? {
              ...state.currentPreviewState,
              issues: upsertIssue(state.currentPreviewState.issues, issue),
            }
          : null,
      })),
    removePreviewIssue: (issueId) =>
      set((state) => ({
        currentPreviewState: state.currentPreviewState
          ? {
              ...state.currentPreviewState,
              issues: state.currentPreviewState.issues.filter(
                (issue) => issue.id !== issueId,
              ),
            }
          : null,
      })),
    clearPreviewIssues: () =>
      set((state) => ({
        currentPreviewState: state.currentPreviewState
          ? { ...state.currentPreviewState, issues: [] }
          : null,
      })),
    reset: () =>
      set({
        ...createInitialCreatePdfViewState(),
        currentPreviewState: null,
      }),
  },
}));

export default useCreatePdfViewStore;

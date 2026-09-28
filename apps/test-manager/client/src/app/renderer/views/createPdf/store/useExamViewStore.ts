import type { ExamViewState, ExamViewValues } from '@views/createPdf/types/viewState';
import { create } from 'zustand';

export const createInitialExamViewState = (): ExamViewValues => ({
  // 模擬試験モードの共通問題テーブル受け皿。
  tableSections: [],
});

const useExamViewStore = create<ExamViewState>((set) => ({
  ...createInitialExamViewState(),
  actions: {
    replaceTableSections: (value) => set({ tableSections: value }),
    reset: () => set(createInitialExamViewState()),
  },
}));

export default useExamViewStore;
import { createInitialExamState } from '@views/createPdf/api/createPdfDraftFactory';
import type {
  CreatePdfBasicDraftState,
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
  CreatePdfOutputDraftState,
  ExamCategoryTableRow,
  ExamState,
} from '@views/createPdf/types/draftState';
import { create } from 'zustand';

type ExamDraftStore = ExamState & {
  actions: {
    setBasic: (patch: Partial<CreatePdfBasicDraftState>) => void;
    setSelectedYears: (value: string[] | null) => void;
    setOptions: (patch: Partial<CreatePdfCommonOptionDraftState>) => void;
    setDifficulty: (patch: Partial<CreatePdfDifficultyDraftState>) => void;
    replaceCategoryTableRows: (value: ExamCategoryTableRow[]) => void;
    setStepThree: (patch: Partial<CreatePdfOutputDraftState>) => void;
    replaceDraft: (next: ExamState) => void;
    reset: () => void;
  };
};

const useExamDraftStore = create<ExamDraftStore>((set) => ({
  ...createInitialExamState(),
  actions: {
    setBasic: (patch) =>
      set((state) => ({ basic: { ...state.basic, ...patch } })),
    setSelectedYears: (value) =>
      set((state) => ({ basic: { ...state.basic, selectedYears: value } })),
    setOptions: (patch) =>
      set((state) => ({
        stepTwo: {
          ...state.stepTwo,
          options: { ...state.stepTwo.options, ...patch },
        },
      })),
    setDifficulty: (patch) =>
      set((state) => ({
        stepTwo: {
          ...state.stepTwo,
          difficulty: { ...state.stepTwo.difficulty, ...patch },
        },
      })),
    replaceCategoryTableRows: (value) =>
      set((state) => ({
        stepTwo: { ...state.stepTwo, categoryTable: value },
      })),
    setStepThree: (patch) =>
      set((state) => ({ stepThree: { ...state.stepThree, ...patch } })),
    replaceDraft: (next) => set({ ...next }),
    reset: () => set(createInitialExamState()),
  },
}));

export default useExamDraftStore;

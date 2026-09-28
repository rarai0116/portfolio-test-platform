import { createInitialWorkbookState } from '@views/createPdf/api/createPdfDraftFactory';
import type {
  CreatePdfBasicDraftState,
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
  CreatePdfOutputDraftState,
  WorkbookState,
} from '@views/createPdf/types/draftState';
import type {
  WorkbookCategoryTableRow,
  WorkbookMode,
} from '@views/createPdf/types/viewState';
import { create } from 'zustand';

type WorkbookDraftStore = WorkbookState & {
  actions: {
    setBasic: (patch: Partial<CreatePdfBasicDraftState>) => void;
    setSelectedYears: (value: string[] | null) => void;
    setOptions: (patch: Partial<CreatePdfCommonOptionDraftState>) => void;
    setDifficulty: (patch: Partial<CreatePdfDifficultyDraftState>) => void;
    setWorkbookMode: (value: WorkbookMode) => void;
    replaceCategoryConditions: (value: WorkbookCategoryTableRow[]) => void;
    setStepThree: (patch: Partial<CreatePdfOutputDraftState>) => void;
    replaceDraft: (next: WorkbookState) => void;
    reset: () => void;
  };
};

const useWorkbookDraftStore = create<WorkbookDraftStore>((set) => ({
  ...createInitialWorkbookState(),
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
    setWorkbookMode: (value) =>
      set((state) => ({
        stepTwo: { ...state.stepTwo, workbookMode: value },
      })),
    replaceCategoryConditions: (value) =>
      set((state) => ({
        stepTwo: { ...state.stepTwo, categoryTable: value },
      })),
    setStepThree: (patch) =>
      set((state) => ({ stepThree: { ...state.stepThree, ...patch } })),
    replaceDraft: (next) => set({ ...next }),
    reset: () => set(createInitialWorkbookState()),
  },
}));

export default useWorkbookDraftStore;

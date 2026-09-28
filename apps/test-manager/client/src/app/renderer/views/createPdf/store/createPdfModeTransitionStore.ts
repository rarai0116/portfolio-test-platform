import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import type { CreationType } from '@views/createPdf/types/viewState';
import { create } from 'zustand';

export type CreatePdfModeTransitionPath =
  | '/createPdf/exam'
  | '/createPdf/workbook';

type CreatePdfModeTransitionBeginInput = {
  sourcePath: CreatePdfModeTransitionPath;
  targetPath: CreatePdfModeTransitionPath;
  targetCreationType: CreationType;
  loadingId: string;
};

type CreatePdfModeTransitionStateValues = {
  isTransitioning: boolean;
  shouldRestorePreviewWindow: boolean;
  sourcePath: CreatePdfModeTransitionPath | null;
  targetPath: CreatePdfModeTransitionPath | null;
  targetCreationType: CreationType | null;
  transitionId: string | null;
  loadingId: string | null;
};

type CreatePdfModeTransitionState = CreatePdfModeTransitionStateValues & {
  actions: {
    begin: (input: CreatePdfModeTransitionBeginInput) => string;
    setShouldRestorePreviewWindow: (
      transitionId: string,
      value: boolean,
    ) => void;
    complete: (transitionId: string) => void;
    consumeRestoreIntent: () => boolean;
    reset: () => void;
  };
};

const INITIAL_STATE: CreatePdfModeTransitionStateValues = {
  isTransitioning: false,
  shouldRestorePreviewWindow: false,
  sourcePath: null,
  targetPath: null,
  targetCreationType: null,
  transitionId: null,
  loadingId: null,
};

const createTransitionId = () =>
  `create_pdf_mode_transition_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const hideLoading = (loadingId: string | null) => {
  if (!loadingId) return;
  useGlobalLoadingStore.getState().hide(loadingId);
};

export const createPdfModeTransitionStore =
  create<CreatePdfModeTransitionState>((set, get) => ({
    ...INITIAL_STATE,
    actions: {
      begin: (input) => {
        const transitionId = createTransitionId();
        set({
          ...INITIAL_STATE,
          isTransitioning: true,
          sourcePath: input.sourcePath,
          targetPath: input.targetPath,
          targetCreationType: input.targetCreationType,
          transitionId,
          loadingId: input.loadingId,
        });
        return transitionId;
      },
      setShouldRestorePreviewWindow: (transitionId, value) => {
        if (get().transitionId !== transitionId) return;
        set({ shouldRestorePreviewWindow: value });
      },
      complete: (transitionId) => {
        const current = get();
        if (current.transitionId !== transitionId) return;
        hideLoading(current.loadingId);
        set(INITIAL_STATE);
      },
      consumeRestoreIntent: () => {
        const shouldRestorePreviewWindow = get().shouldRestorePreviewWindow;
        set({ shouldRestorePreviewWindow: false });
        return shouldRestorePreviewWindow;
      },
      reset: () => {
        hideLoading(get().loadingId);
        set(INITIAL_STATE);
      },
    },
  }));

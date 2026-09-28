import type { CreatePdfExportPreviewWindowStatus } from '@shared/types/createPdfExport';
import { create } from 'zustand';

export const CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS: CreatePdfExportPreviewWindowStatus =
  {
    isOpen: false,
    isReady: false,
    creationType: null,
    slotKey: null,
    revision: null,
    isRendering: false,
  };

type PreviewWindowStatusUpdater =
  | CreatePdfExportPreviewWindowStatus
  | ((
      previous: CreatePdfExportPreviewWindowStatus,
    ) => CreatePdfExportPreviewWindowStatus);

type CreatePdfStatusRuntimeStore = {
  previewWindowStatus: CreatePdfExportPreviewWindowStatus;
  isExporting: boolean;
  isBfsCalculating: boolean;
  actions: {
    setPreviewWindowStatus: (updater: PreviewWindowStatusUpdater) => void;
    setIsExporting: (value: boolean) => void;
    setIsBfsCalculating: (value: boolean) => void;
    reset: () => void;
  };
};

const isSamePreviewWindowStatus = (
  left: CreatePdfExportPreviewWindowStatus,
  right: CreatePdfExportPreviewWindowStatus,
): boolean =>
  left.isOpen === right.isOpen &&
  left.isReady === right.isReady &&
  left.isRendering === right.isRendering &&
  left.revision === right.revision &&
  left.slotKey === right.slotKey &&
  left.creationType === right.creationType;

const useCreatePdfStatusRuntimeStore = create<CreatePdfStatusRuntimeStore>(
  (set) => ({
    previewWindowStatus: CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
    isExporting: false,
    isBfsCalculating: false,
    actions: {
      setPreviewWindowStatus: (updater) => {
        set((state) => {
          const next =
            typeof updater === 'function'
              ? updater(state.previewWindowStatus)
              : updater;
          if (isSamePreviewWindowStatus(state.previewWindowStatus, next)) {
            return state;
          }
          return { previewWindowStatus: next };
        });
      },
      setIsExporting: (value) => {
        set((state) =>
          state.isExporting === value ? state : { isExporting: value },
        );
      },
      setIsBfsCalculating: (value) => {
        set((state) =>
          state.isBfsCalculating === value
            ? state
            : { isBfsCalculating: value },
        );
      },
      reset: () =>
        set({
          previewWindowStatus: CLOSED_CREATE_PDF_PREVIEW_WINDOW_STATUS,
          isExporting: false,
          isBfsCalculating: false,
        }),
    },
  }),
);

export default useCreatePdfStatusRuntimeStore;

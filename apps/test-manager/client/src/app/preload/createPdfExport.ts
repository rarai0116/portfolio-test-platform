import {
  CreatePdfExportChannels,
  type CreatePdfExportPreviewUpdateRequest,
  type CreatePdfExportPreviewUpdateRequestResult,
  type CreatePdfExportPreviewWindowCloseResult,
  type CreatePdfExportPreviewWindowOpenRequest,
  type CreatePdfExportPreviewWindowOpenResult,
  type CreatePdfExportPreviewWindowStatusResult,
  type CreatePdfExportRequest,
  type CreatePdfExportResult,
  type CreatePdfLoadConditionJsonRequest,
  type CreatePdfLoadConditionJsonResult,
  type CreatePdfSelectOutputDirectoryRequest,
  type CreatePdfSelectOutputDirectoryResult,
} from '@shared/types/createPdfExport';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('createPdfExport', {
  openPreviewWindow: (
    request: CreatePdfExportPreviewWindowOpenRequest,
  ): Promise<CreatePdfExportPreviewWindowOpenResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.openPreviewWindow, request)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  closePreviewWindow: (): Promise<CreatePdfExportPreviewWindowCloseResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.closePreviewWindow)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  getPreviewWindowStatus:
    (): Promise<CreatePdfExportPreviewWindowStatusResult> =>
      ipcRenderer
        .invoke(CreatePdfExportChannels.getPreviewWindowStatus)
        .catch((error) => ({
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        })),

  requestPreviewUpdate: (
    request: CreatePdfExportPreviewUpdateRequest,
  ): Promise<CreatePdfExportPreviewUpdateRequestResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.requestPreviewUpdate, request)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  selectOutputDirectory: (
    request?: CreatePdfSelectOutputDirectoryRequest,
  ): Promise<CreatePdfSelectOutputDirectoryResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.selectOutputDirectory, request)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  exportPdf: (
    request: CreatePdfExportRequest,
  ): Promise<CreatePdfExportResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.exportPdf, request)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  loadConditionJson: (
    request: CreatePdfLoadConditionJsonRequest,
  ): Promise<CreatePdfLoadConditionJsonResult> =>
    ipcRenderer
      .invoke(CreatePdfExportChannels.loadConditionJson, request)
      .catch((error) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      })),

  onPreviewWindowClosed: (handler: () => void): (() => void) => {
    const listener = () => handler();
    ipcRenderer.on(CreatePdfExportChannels.previewWindowClosed, listener);
    return () =>
      ipcRenderer.off(CreatePdfExportChannels.previewWindowClosed, listener);
  },

  onPreviewUpdateRequested: (
    handler: (request: CreatePdfExportPreviewUpdateRequest) => void,
  ): (() => void) => {
    const listener = (
      _: unknown,
      request: CreatePdfExportPreviewUpdateRequest,
    ) => handler(request);
    ipcRenderer.on(CreatePdfExportChannels.previewUpdateRequested, listener);
    return () =>
      ipcRenderer.off(CreatePdfExportChannels.previewUpdateRequested, listener);
  },
});

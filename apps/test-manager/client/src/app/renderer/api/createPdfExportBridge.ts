import type {
  CreatePdfExportPreviewUpdateRequest,
  CreatePdfExportPreviewUpdateRequestResult,
  CreatePdfExportPreviewWindowCloseResult,
  CreatePdfExportPreviewWindowOpenRequest,
  CreatePdfExportPreviewWindowOpenResult,
  CreatePdfExportPreviewWindowStatusResult,
  CreatePdfExportRequest,
  CreatePdfExportResult,
  CreatePdfLoadConditionJsonRequest,
  CreatePdfLoadConditionJsonResult,
  CreatePdfSelectOutputDirectoryRequest,
  CreatePdfSelectOutputDirectoryResult,
} from '@shared/types/createPdfExport';

export const openCreatePdfPreviewWindow = (
  request: CreatePdfExportPreviewWindowOpenRequest,
): Promise<CreatePdfExportPreviewWindowOpenResult> =>
  window.createPdfExport.openPreviewWindow(request);

export const getCreatePdfPreviewWindowStatus =
  (): Promise<CreatePdfExportPreviewWindowStatusResult> =>
    window.createPdfExport.getPreviewWindowStatus();

export const requestCreatePdfPreviewUpdate = (
  request: CreatePdfExportPreviewUpdateRequest,
): Promise<CreatePdfExportPreviewUpdateRequestResult> =>
  window.createPdfExport.requestPreviewUpdate(request);

export const selectCreatePdfOutputDirectory = (
  request?: CreatePdfSelectOutputDirectoryRequest,
): Promise<CreatePdfSelectOutputDirectoryResult> =>
  window.createPdfExport.selectOutputDirectory(request);

export const exportCreatePdf = (
  request: CreatePdfExportRequest,
): Promise<CreatePdfExportResult> => window.createPdfExport.exportPdf(request);

export const closeCreatePdfPreviewWindow =
  (): Promise<CreatePdfExportPreviewWindowCloseResult> =>
    window.createPdfExport.closePreviewWindow();

export const loadConditionJson = (
  request: CreatePdfLoadConditionJsonRequest,
): Promise<CreatePdfLoadConditionJsonResult> =>
  window.createPdfExport.loadConditionJson(request);

export const onCreatePdfPreviewWindowClosed = (
  handler: () => void,
): (() => void) => window.createPdfExport.onPreviewWindowClosed(handler);

export const onCreatePdfPreviewUpdateRequested = (
  handler: (request: CreatePdfExportPreviewUpdateRequest) => void,
): (() => void) => window.createPdfExport.onPreviewUpdateRequested(handler);

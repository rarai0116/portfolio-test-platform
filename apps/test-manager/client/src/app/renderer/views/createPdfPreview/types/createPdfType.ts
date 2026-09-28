import type { AssetReadyNotice } from '@shared/types/assets';
import type { CreatePdfExportPreviewWindowStatus } from '@shared/types/createPdfExport';
import type { CreatePdfPreviewSnapshot } from '@shared/types/pdfPreview';

export const CLOSED_STATUS: CreatePdfExportPreviewWindowStatus = {
  isOpen: true,
  isReady: false,
  creationType: null,
  slotKey: null,
  revision: null,
  isRendering: false,
};

export type CreatePdfPreviewWindowRenderCache = {
  snapshot: CreatePdfPreviewSnapshot;
  revision: number;
  readyItemsByKey: Map<string, AssetReadyNotice>;
};

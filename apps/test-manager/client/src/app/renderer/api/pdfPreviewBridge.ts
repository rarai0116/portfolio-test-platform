import type {
  CreatePdfPersistedDocument,
  CreatePdfPreviewCommitInput,
  CreatePdfPreviewCommitResult,
  CreatePdfPreviewPatchPayload,
  CreatePdfPreviewReadResult,
  CreatePdfPreviewRefreshResult,
  CreatePdfPreviewUpdatedEvent,
  CreationType,
} from '@shared/types/pdfPreview';

export const commitCreatePdfPreviewDocument = (
  input: CreatePdfPreviewCommitInput,
): Promise<CreatePdfPreviewCommitResult> => window.pdfPreview.commit(input);

export const refreshCreatePdfPreview = (
  creationType: CreationType,
  slotKey: string,
): Promise<CreatePdfPreviewRefreshResult> =>
  window.pdfPreview.refresh(creationType, slotKey);

export const readCreatePdfPreviewDocument = (
  creationType: CreationType,
): Promise<CreatePdfPreviewReadResult> => window.pdfPreview.read(creationType);

export const notifyCreatePdfPreviewPatch = (
  payload: CreatePdfPreviewPatchPayload,
): Promise<{ ok: true } | { ok: false; error: string }> =>
  window.pdfPreview.notifyPatch(payload);

export const subscribeCreatePdfPreviewUpdated = (
  handler: (event: CreatePdfPreviewUpdatedEvent) => void,
): (() => void) => window.pdfPreview.onUpdated(handler);

export const subscribeCreatePdfPreviewPatch = (
  handler: (payload: CreatePdfPreviewPatchPayload) => void,
): (() => void) => window.pdfPreview.onPatch(handler);

/** 保存文書から対象 slotKey のドキュメントを取り出す便利関数 */
export const selectSlot = (doc: CreatePdfPersistedDocument, slotKey: string) =>
  doc.slots[slotKey] ?? null;

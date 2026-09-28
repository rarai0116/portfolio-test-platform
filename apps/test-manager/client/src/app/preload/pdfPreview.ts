import {
  type CreatePdfPreviewCommitInput,
  type CreatePdfPreviewCommitResult,
  type CreatePdfPreviewPatchPayload,
  type CreatePdfPreviewReadResult,
  type CreatePdfPreviewRefreshResult,
  type CreatePdfPreviewUpdatedEvent,
  type CreationType,
  PdfPreviewChannels,
} from '@shared/types/pdfPreview';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pdfPreview', {
  commit: (
    input: CreatePdfPreviewCommitInput,
  ): Promise<CreatePdfPreviewCommitResult> =>
    ipcRenderer.invoke(PdfPreviewChannels.commit, input).catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),

  refresh: (
    creationType: CreationType,
    slotKey: string,
  ): Promise<CreatePdfPreviewRefreshResult> =>
    ipcRenderer
      .invoke(PdfPreviewChannels.refresh, creationType, slotKey)
      .catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      })),

  read: (creationType: CreationType): Promise<CreatePdfPreviewReadResult> =>
    ipcRenderer.invoke(PdfPreviewChannels.read, creationType).catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),

  notifyPatch: (
    payload: CreatePdfPreviewPatchPayload,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke(PdfPreviewChannels.patch, payload).catch((e) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : String(e),
    })),

  onUpdated: (
    handler: (event: CreatePdfPreviewUpdatedEvent) => void,
  ): (() => void) => {
    const listener = (_: unknown, event: CreatePdfPreviewUpdatedEvent) =>
      handler(event);
    ipcRenderer.on(PdfPreviewChannels.updated, listener);
    return () => ipcRenderer.off(PdfPreviewChannels.updated, listener);
  },

  onPatch: (
    handler: (payload: CreatePdfPreviewPatchPayload) => void,
  ): (() => void) => {
    const listener = (_: unknown, payload: CreatePdfPreviewPatchPayload) =>
      handler(payload);
    ipcRenderer.on(PdfPreviewChannels.patch, listener);
    return () => ipcRenderer.off(PdfPreviewChannels.patch, listener);
  },
});

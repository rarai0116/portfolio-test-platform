import {
  PreviewChannels,
  type PreviewGetLatestResult,
  type PreviewImagePatchPayload,
  type PreviewSendPayload,
  type PreviewSetPayload,
  type PreviewWindowCloseResult,
  type PreviewWindowOpenResult,
} from '@shared/types/preview';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('preview', {
  send: (payload: PreviewSendPayload) =>
    ipcRenderer.invoke(PreviewChannels.send, payload).catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })),
  onSet: (handler: (payload: PreviewSetPayload) => void) => {
    const listener = (_: unknown, payload: PreviewSetPayload) =>
      handler(payload);
    ipcRenderer.on(PreviewChannels.set, listener);
    return () => ipcRenderer.off(PreviewChannels.set, listener);
  },
  getLatest: (): Promise<PreviewGetLatestResult> =>
    ipcRenderer.invoke(PreviewChannels.getLatest),
  // 画像パッチ送信
  patchImages: (payload: PreviewImagePatchPayload) =>
    ipcRenderer
      .invoke(PreviewChannels.imagePatch, payload)
      .then(() => ({ ok: true as const }))
      .catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      })),
  // 画像パッチ購読
  onImagePatch: (handler: (payload: PreviewImagePatchPayload) => void) => {
    const listener = (_: unknown, payload: PreviewImagePatchPayload) =>
      handler(payload);
    ipcRenderer.on(PreviewChannels.imagePatch, listener);
    return () => ipcRenderer.off(PreviewChannels.imagePatch, listener);
  },
  openWindow: (): Promise<PreviewWindowOpenResult> =>
    ipcRenderer.invoke(PreviewChannels.openWindow),
  closeWindow: (): Promise<PreviewWindowCloseResult> =>
    ipcRenderer.invoke(PreviewChannels.closeWindow),

  onWindowClosed: (handler: () => void) => {
    const listener = () => handler();
    ipcRenderer.on(PreviewChannels.windowClosed, listener);
    return () => ipcRenderer.off(PreviewChannels.windowClosed, listener);
  },
});

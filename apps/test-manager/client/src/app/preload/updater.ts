import {
  UpdaterChannels,
  type UpdaterStatusEvent,
} from '@shared/types/updater';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('updater', {
  check: () =>
    ipcRenderer.invoke(UpdaterChannels.check) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  install: () =>
    ipcRenderer.invoke(UpdaterChannels.install) as Promise<
      { ok: true } | { ok: false; error: string }
    >,
  onStatus: (handler: (ev: UpdaterStatusEvent) => void) => {
    const listener = (_: unknown, ev: UpdaterStatusEvent) => handler(ev);
    ipcRenderer.on(UpdaterChannels.status, listener);
    return () => ipcRenderer.off(UpdaterChannels.status, listener);
  },
});

import {
  type BatchGetDocsPayload,
  type BatchGetDocsResult,
  Channels,
  type GetDocPayload,
  type GetDocResult,
  type GetFirestoreCacheMetricsResult,
  type GetOncePayload,
  type GetOnceResult,
  type MutateAccepted,
  type MutateCommitted,
  type MutateFailed,
  type MutatePayload,
  type OutboxUpdate,
  type PatchEvent,
  type PingPayload,
  type ResetFirestoreCacheMetricsResult,
  type SetActiveKeysPayload,
  type SyncCacheIndexEntriesPayload,
  type SyncCacheIndexEntriesResult,
} from '@shared/types/contracts';
import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

const api = {
  setActiveKeys: (payload: SetActiveKeysPayload) =>
    ipcRenderer.invoke(Channels.setActiveKeys, payload),
  ping: (payload: PingPayload) => ipcRenderer.invoke(Channels.ping, payload),
  getOnce: (payload: GetOncePayload): Promise<GetOnceResult> =>
    ipcRenderer.invoke(Channels.getOnce, payload),
  getDoc: (payload: GetDocPayload): Promise<GetDocResult> =>
    ipcRenderer.invoke(Channels.getDoc, payload),
  batchGetDocs: (payload: BatchGetDocsPayload): Promise<BatchGetDocsResult> =>
    ipcRenderer.invoke(Channels.batchGetDocs, payload),
  syncCacheIndexEntries: (
    payload: SyncCacheIndexEntriesPayload,
  ): Promise<SyncCacheIndexEntriesResult> =>
    ipcRenderer.invoke(Channels.syncCacheIndexEntries, payload),
  getFirestoreCacheMetrics: (): Promise<GetFirestoreCacheMetricsResult> =>
    ipcRenderer.invoke(Channels.getFirestoreCacheMetrics),
  resetFirestoreCacheMetrics: (): Promise<ResetFirestoreCacheMetricsResult> =>
    ipcRenderer.invoke(Channels.resetFirestoreCacheMetrics),
  mutate: (payload: MutatePayload): Promise<MutateAccepted> =>
    ipcRenderer.invoke(Channels.mutate, payload),
  onPatch: (handler: (ev: PatchEvent) => void): Unsubscribe => {
    const fn = (_: Electron.IpcRendererEvent, ev: PatchEvent) => handler(ev);
    ipcRenderer.on(Channels.patch, fn);
    return () => ipcRenderer.off(Channels.patch, fn);
  },
  onMutationAccepted: (handler: (ev: MutateAccepted) => void): Unsubscribe => {
    const fn = (_: Electron.IpcRendererEvent, ev: MutateAccepted) =>
      handler(ev);
    ipcRenderer.on(Channels.mutationAccepted, fn);
    return () => ipcRenderer.off(Channels.mutationAccepted, fn);
  },
  onMutationCommitted: (
    handler: (ev: MutateCommitted) => void,
  ): Unsubscribe => {
    const fn = (_: Electron.IpcRendererEvent, ev: MutateCommitted) =>
      handler(ev);
    ipcRenderer.on(Channels.mutationCommitted, fn);
    return () => ipcRenderer.off(Channels.mutationCommitted, fn);
  },
  onMutationFailed: (handler: (ev: MutateFailed) => void): Unsubscribe => {
    const fn = (_: Electron.IpcRendererEvent, ev: MutateFailed) => handler(ev);
    ipcRenderer.on(Channels.mutationFailed, fn);
    return () => ipcRenderer.off(Channels.mutationFailed, fn);
  },
  onOutboxUpdate: (handler: (ev: OutboxUpdate) => void): Unsubscribe => {
    const fn = (_: Electron.IpcRendererEvent, ev: OutboxUpdate) => handler(ev);
    ipcRenderer.on(Channels.outboxUpdate, fn);
    return () => ipcRenderer.off(Channels.outboxUpdate, fn);
  },
  getOutbox: (): Promise<OutboxUpdate> =>
    ipcRenderer.invoke(Channels.getOutbox),
};

contextBridge.exposeInMainWorld('fs', api);

declare global {
  interface Window {
    fs: typeof api;
  }
}

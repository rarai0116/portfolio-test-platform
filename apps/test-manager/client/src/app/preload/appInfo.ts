import { AppInfoChannels, type AppInfoResult } from '@shared/types/appInfo';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('appInfo', {
  get: () => ipcRenderer.invoke(AppInfoChannels.get) as Promise<AppInfoResult>,
});
import './loggerBootstrap';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, webUtils } from 'electron';
import './firebase';
import './assets';
import './preview';
import './pdfPreview';
import './createPdfExport';
import './updater';
import './appInfo';
import './csvFile';
import './testCategory';
import './telemetry';
import './memoryProbe';
import './agentEnvMarker';

const api = {};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('webUtils', webUtils);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
}

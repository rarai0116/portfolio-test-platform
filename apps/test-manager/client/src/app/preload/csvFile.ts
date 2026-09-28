import {
  CsvFileChannels,
  type OpenCsvResult,
  type SaveCsvResult,
} from '@shared/types/csvFile';
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  openCsv: async (): Promise<OpenCsvResult> => {
    try {
      const res = (await ipcRenderer.invoke(
        CsvFileChannels.open,
      )) as OpenCsvResult;
      return res;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  saveCsv: async (
    bytes: Uint8Array,
    suggestedName: string,
  ): Promise<SaveCsvResult> => {
    try {
      const res = (await ipcRenderer.invoke(CsvFileChannels.save, {
        bytes,
        suggestedName,
      })) as SaveCsvResult;
      return res;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

contextBridge.exposeInMainWorld('csvFile', api);

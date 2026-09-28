import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  CsvFileChannels,
  type OpenCsvResult,
  type SaveCsvResult,
} from '@shared/types/csvFile';
import { type BrowserWindow, dialog, ipcMain } from 'electron';

type SavePayload = { bytes: Uint8Array; suggestedName: string };

export function registerCsvFileIpc(mainWindow: BrowserWindow) {
  // macでウィンドウを閉じて再生成した時の二重登録を避ける
  ipcMain.removeHandler(CsvFileChannels.open);
  ipcMain.removeHandler(CsvFileChannels.save);

  ipcMain.handle(CsvFileChannels.open, async (): Promise<OpenCsvResult> => {
    try {
      const res = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { ok: false, error: 'キャンセルされました' };
      }

      const filePath = res.filePaths[0];
      const buf = await fs.readFile(filePath);
      return {
        ok: true,
        bytes: new Uint8Array(buf),
        fileName: path.basename(filePath),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle(
    CsvFileChannels.save,
    async (_evt, payload: SavePayload): Promise<SaveCsvResult> => {
      try {
        const suggestedName = payload?.suggestedName?.trim() || 'testdata.csv';

        const res = await dialog.showSaveDialog(mainWindow, {
          defaultPath: suggestedName,
          filters: [{ name: 'CSV', extensions: ['csv'] }],
        });
        if (res.canceled || !res.filePath) {
          return { ok: false, error: 'キャンセルされました' };
        }

        await fs.writeFile(res.filePath, Buffer.from(payload.bytes));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );
}

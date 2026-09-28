import {
  checkForUpdatesWithDynamicFeed,
  initUpdater,
  installUpdate,
} from '@main/services/updater';
import { UpdaterChannels } from '@shared/types/updater';
import type { BrowserWindow } from 'electron';
import { app, ipcMain } from 'electron';

export function registerUpdaterIpc(mainWindow: BrowserWindow) {
  ipcMain.removeHandler(UpdaterChannels.check);
  ipcMain.removeHandler(UpdaterChannels.install);

  initUpdater(mainWindow);

  ipcMain.handle(UpdaterChannels.check, async () => {
    try {
      mainWindow.webContents.send(UpdaterChannels.status, { type: 'checking' });
      if (app.isPackaged) {
        await checkForUpdatesWithDynamicFeed();
      }
      return { ok: true as const };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle(UpdaterChannels.install, async () => {
    try {
      installUpdate();
      return { ok: true as const };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}

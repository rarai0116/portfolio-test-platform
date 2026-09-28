import { AppInfoChannels, type AppInfoResult } from '@shared/types/appInfo';
import { app, ipcMain } from 'electron';

export function registerAppInfoIpc() {
  ipcMain.removeHandler(AppInfoChannels.get);

  ipcMain.handle(AppInfoChannels.get, async (): Promise<AppInfoResult> => {
    try {
      return {
        ok: true,
        name: app.getName(),
        version: app.getVersion(),
        isPackaged: app.isPackaged,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
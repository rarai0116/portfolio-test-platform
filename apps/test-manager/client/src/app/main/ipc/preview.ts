import { join } from 'node:path';
import { isSafeExternalUrl } from '@main/services/externalUrl';
import { getRendererBaseUrl } from '@main/services/rendererBase';
import { attachWindowTelemetry } from '@main/services/telemetry/windowMonitor';
import {
  PreviewChannels,
  type PreviewImagePatchPayload,
  type PreviewResolvedPayload,
  type PreviewWindowCloseResult,
  type PreviewWindowOpenResult,
} from '@shared/types/preview';
import { BrowserWindow, ipcMain, shell } from 'electron';

let latest: PreviewResolvedPayload | null = null;
let previewWindow: BrowserWindow | null = null;
let ownerWindow: BrowserWindow | null = null;
const isDevelopment = process.env.NODE_ENV === 'development';

const broadcastToAllWindows = (channel: string, payload?: unknown) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    if (payload === undefined) {
      window.webContents.send(channel);
    } else {
      window.webContents.send(channel, payload);
    }
  }
};

const resolvePreviewWindowUrl = () => {
  const base = getRendererBaseUrl();

  if (base?.startsWith('http')) {
    return `${base}#/previewWindow`;
  }

  return `file://${join(__dirname, '../renderer/index.html')}#/previewWindow`;
};

const closePreviewWindowByOwner = () => {
  if (!previewWindow || previewWindow.isDestroyed()) {
    previewWindow = null;
    ownerWindow = null;
    return;
  }

  const currentPreviewWindow = previewWindow;
  previewWindow = null;
  ownerWindow = null;
  currentPreviewWindow.destroy();
};

export function registerPreviewIpc() {
  ipcMain.removeHandler(PreviewChannels.send);
  ipcMain.removeHandler(PreviewChannels.getLatest);
  ipcMain.removeHandler(PreviewChannels.imagePatch);
  ipcMain.removeHandler(PreviewChannels.openWindow);
  ipcMain.removeHandler(PreviewChannels.closeWindow);

  ipcMain.handle(
    PreviewChannels.send,
    async (
      _evt,
      payload: PreviewResolvedPayload,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        if (!payload?.id) return { ok: false, error: 'idがありません' };

        latest = payload;
        broadcastToAllWindows(PreviewChannels.set, payload);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(PreviewChannels.getLatest, async () => {
    return { ok: true, payload: latest ?? undefined };
  });

  ipcMain.handle(
    PreviewChannels.imagePatch,
    async (
      _evt,
      payload: PreviewImagePatchPayload,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        if (!payload?.id) return { ok: false, error: 'idがありません' };

        broadcastToAllWindows(PreviewChannels.imagePatch, payload);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    PreviewChannels.openWindow,
    async (evt): Promise<PreviewWindowOpenResult> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(evt.sender);

        if (!senderWindow) {
          return {
            ok: false,
            error: '親ウィンドウの取得に失敗しました',
          };
        }

        ownerWindow = senderWindow;

        if (previewWindow && !previewWindow.isDestroyed()) {
          previewWindow.focus();
          return { ok: true, reused: true };
        }

        const childWindow = new BrowserWindow({
          width: 1200,
          height: 900,
          minWidth: 900,
          minHeight: 700,
          show: false,
          autoHideMenuBar: true,
          webPreferences: {
            preload: join(__dirname, '../preload/index.cjs'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDevelopment,
          },
        });
        attachWindowTelemetry(childWindow, 'preview');

        previewWindow = childWindow;

        senderWindow.once('closed', () => {
          closePreviewWindowByOwner();
        });

        childWindow.on('ready-to-show', () => {
          childWindow.show();
        });

        childWindow.on('closed', () => {
          previewWindow = null;

          const targetOwnerWindow = ownerWindow;
          ownerWindow = null;

          if (targetOwnerWindow && !targetOwnerWindow.isDestroyed()) {
            targetOwnerWindow.webContents.send(PreviewChannels.windowClosed);
          }
        });

        childWindow.webContents.setWindowOpenHandler((details) => {
          if (!isSafeExternalUrl(details.url)) {
            console.warn('Blocked external URL:', details.url);
            return { action: 'deny' };
          }

          void shell.openExternal(details.url);
          return { action: 'deny' };
        });

        await childWindow.loadURL(resolvePreviewWindowUrl());

        if (isDevelopment) {
          childWindow.webContents.openDevTools({ mode: 'detach' });
        }

        return { ok: true, reused: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    PreviewChannels.closeWindow,
    async (): Promise<PreviewWindowCloseResult> => {
      try {
        closePreviewWindowByOwner();
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );
}

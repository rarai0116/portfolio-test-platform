import {
  UpdaterChannels,
  type UpdaterStatusEvent,
} from '@shared/types/updater';
import type { BrowserWindow } from 'electron';
import updaterPkg from 'electron-updater';
import { fetchAndDecryptUpdateBaseUrl } from './updateConfig';

const { autoUpdater } = updaterPkg;

let initialized = false;

export function initUpdater(mainWindow: BrowserWindow) {
  if (initialized) return;
  initialized = true;

  const send = (ev: UpdaterStatusEvent) => {
    mainWindow.webContents.send(UpdaterChannels.status, ev);
  };

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }));
  autoUpdater.on('update-available', () => send({ type: 'available' }));
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    send({
      type: 'downloading',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
    }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    send({
      type: 'downloaded',
      releaseName: info?.releaseName ?? undefined,
      releaseNotes:
        typeof info?.releaseNotes === 'string' ? info.releaseNotes : undefined,
    }),
  );
  autoUpdater.on('error', (e) =>
    send({
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    }),
  );
}

export async function checkForUpdatesWithDynamicFeed() {
  const baseUrl = await fetchAndDecryptUpdateBaseUrl();

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: baseUrl,
  });

  autoUpdater.autoDownload = true;

  return autoUpdater.checkForUpdates();
}

export function installUpdate() {
  autoUpdater.quitAndInstall();
}

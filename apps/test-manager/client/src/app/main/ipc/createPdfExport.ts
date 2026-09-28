import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSafeExternalUrl } from '@main/services/externalUrl';
import { getRendererBaseUrl } from '@main/services/rendererBase';
import { attachWindowTelemetry } from '@main/services/telemetry/windowMonitor';
import {
  CreatePdfExportChannels,
  type CreatePdfExportManifestOptions,
  type CreatePdfExportManifestResult,
  type CreatePdfExportPagesRange,
  type CreatePdfExportPreviewUpdateRequest,
  type CreatePdfExportPreviewUpdateRequestResult,
  type CreatePdfExportPreviewWindowCloseResult,
  type CreatePdfExportPreviewWindowOpenRequest,
  type CreatePdfExportPreviewWindowOpenResult,
  type CreatePdfExportPreviewWindowStatus,
  type CreatePdfExportPreviewWindowStatusResult,
  type CreatePdfExportRequest,
  type CreatePdfExportResult,
  type CreatePdfLoadConditionJsonRequest,
  type CreatePdfLoadConditionJsonResult,
  type CreatePdfSelectOutputDirectoryRequest,
  type CreatePdfSelectOutputDirectoryResult,
} from '@shared/types/createPdfExport';
import {
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
  shell,
} from 'electron';

const isDevelopment = process.env.NODE_ENV === 'development';

const CLOSED_STATUS: CreatePdfExportPreviewWindowStatus = {
  isOpen: false,
  isReady: false,
  creationType: null,
  slotKey: null,
  revision: null,
  isRendering: false,
};

let previewWindow: BrowserWindow | null = null;
let ownerWindow: BrowserWindow | null = null;
// SPA ナビゲーション検知リスナーの多重登録を防ぐフラグ
let isNavigateListenerRegistered = false;

const resolvePreviewWindowUrl = ({
  creationType,
  slotKey,
}: CreatePdfExportPreviewWindowOpenRequest): string => {
  const base = getRendererBaseUrl();
  const search = new URLSearchParams({ creationType, slotKey }).toString();

  if (base?.startsWith('http')) {
    return `${base.replace(/\/$/, '')}/createPdfPreviewWindow.html#/createPdfPreviewWindow?${search}`;
  }

  return `file://${join(
    __dirname,
    '../renderer/createPdfPreviewWindow.html',
  )}#/createPdfPreviewWindow?${search}`;
};

const closePreviewWindowByOwner = (): void => {
  if (!previewWindow || previewWindow.isDestroyed()) {
    previewWindow = null;
    ownerWindow = null;
    return;
  }

  const currentWindow = previewWindow;
  previewWindow = null;
  ownerWindow = null;
  // closable: false でも destroy() は必ず破棄できる
  currentWindow.destroy();
};

const sanitizePathSegment = (value: string): string => {
  const sanitized = value.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'untitled';
};

const formatTimestamp = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const readBridgeStatus =
  async (): Promise<CreatePdfExportPreviewWindowStatus> => {
    if (!previewWindow || previewWindow.isDestroyed()) {
      return CLOSED_STATUS;
    }

    const status = await previewWindow.webContents.executeJavaScript(`
    (() => {
      const bridge = globalThis.__CREATE_PDF_PREVIEW_WINDOW__;
      if (!bridge || typeof bridge.getStatus !== 'function') {
        return null;
      }
      return bridge.getStatus();
    })()
  `);

    if (!status || typeof status !== 'object') {
      return { ...CLOSED_STATUS, isOpen: true };
    }

    return {
      ...CLOSED_STATUS,
      isOpen: true,
      ...status,
    };
  };

const readBridgeManifest = async (
  options: CreatePdfExportManifestOptions,
): Promise<CreatePdfExportManifestResult> => {
  if (!previewWindow || previewWindow.isDestroyed()) {
    return { ok: false, error: 'PDF出力用のPreviewWindowが開いていません。' };
  }
  const serializedOptions = JSON.stringify(options);

  const result = await previewWindow.webContents.executeJavaScript(`
    (() => {
      const bridge = globalThis.__CREATE_PDF_PREVIEW_WINDOW__;
      if (!bridge || typeof bridge.getManifest !== 'function') {
        return { ok: false, error: 'PreviewWindow bridge is not ready.' };
      }
      return bridge.getManifest(${serializedOptions});
    })()
  `);

  if (!result || typeof result !== 'object') {
    return {
      ok: false,
      error: 'PreviewWindow から export manifest を取得できませんでした。',
    };
  }

  return result as CreatePdfExportManifestResult;
};

const formatPagesRange = (range: CreatePdfExportPagesRange): string =>
  range.start === range.end
    ? String(range.start)
    : `${range.start}-${range.end}`;

const buildPrintPageRanges = (unit: {
  pagesRange?: CreatePdfExportPagesRange;
  pagesRanges?: CreatePdfExportPagesRange[];
}): string | undefined => {
  if (unit.pagesRanges && unit.pagesRanges.length > 0) {
    return unit.pagesRanges.map(formatPagesRange).join(',');
  }

  return unit.pagesRange ? formatPagesRange(unit.pagesRange) : undefined;
};

const toPdfDocumentTitle = (fileName: string): string =>
  fileName.replace(/\.pdf$/i, '');

const callBridgeSetDocumentTitle = async (
  title: string,
): Promise<string | null> => {
  if (!previewWindow || previewWindow.isDestroyed()) return null;
  const serializedTitle = JSON.stringify(title);
  const previousTitle = await previewWindow.webContents.executeJavaScript(`
    (() => {
      const previousTitle = document.title;
      document.title = ${serializedTitle};
      return previousTitle;
    })()
  `);

  return typeof previousTitle === 'string' ? previousTitle : null;
};

const requestOverwriteConfirmation = async (
  targetPath: string,
): Promise<boolean> => {
  const dialogWindow =
    ownerWindow && !ownerWindow.isDestroyed()
      ? ownerWindow
      : previewWindow && !previewWindow.isDestroyed()
        ? previewWindow
        : undefined;

  const dialogOptions = {
    type: 'question' as const,
    buttons: ['上書きする', 'キャンセル'],
    defaultId: 1,
    cancelId: 1,
    message: '同名の出力フォルダが既に存在します。上書きしますか？',
    detail: targetPath,
  };

  const result = dialogWindow
    ? await dialog.showMessageBox(dialogWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);

  return result.response === 0;
};

// ブリッジ経由で setDisplayMode を呼ぶヘルパー
const callBridgeSetDisplayMode = async (
  mode: 'print' | 'patch',
): Promise<void> => {
  if (!previewWindow || previewWindow.isDestroyed()) return;
  await previewWindow.webContents.executeJavaScript(`
    (() => {
      const bridge = globalThis.__CREATE_PDF_PREVIEW_WINDOW__;
      if (typeof bridge?.setDisplayMode === 'function') {
        bridge.setDisplayMode('${mode}');
      }
    })()
  `);
};

export function registerCreatePdfExportIpc(): void {
  ipcMain.removeHandler(CreatePdfExportChannels.openPreviewWindow);
  ipcMain.removeHandler(CreatePdfExportChannels.closePreviewWindow);
  ipcMain.removeHandler(CreatePdfExportChannels.getPreviewWindowStatus);
  ipcMain.removeHandler(CreatePdfExportChannels.requestPreviewUpdate);
  ipcMain.removeHandler(CreatePdfExportChannels.selectOutputDirectory);
  ipcMain.removeHandler(CreatePdfExportChannels.exportPdf);
  ipcMain.removeHandler(CreatePdfExportChannels.loadConditionJson);

  ipcMain.handle(
    CreatePdfExportChannels.openPreviewWindow,
    async (
      evt,
      request: CreatePdfExportPreviewWindowOpenRequest,
    ): Promise<CreatePdfExportPreviewWindowOpenResult> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(evt.sender);
        if (!senderWindow) {
          return { ok: false, error: '親ウィンドウの取得に失敗しました。' };
        }

        ownerWindow = senderWindow;
        const nextUrl = resolvePreviewWindowUrl(request);

        if (previewWindow && !previewWindow.isDestroyed()) {
          if (previewWindow.webContents.getURL() !== nextUrl) {
            await previewWindow.loadURL(nextUrl);
          }
          previewWindow.focus();
          return { ok: true, reused: true };
        }

        const childWindow = new BrowserWindow({
          width: 940,
          height: 960,
          minWidth: 400,
          show: false,
          closable: true,
          autoHideMenuBar: true,
          webPreferences: {
            preload: join(__dirname, '../preload/index.cjs'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDevelopment,
            backgroundThrottling: false,
          },
        });

        attachWindowTelemetry(childWindow, 'preview');
        previewWindow = childWindow;

        //　devtoolsを表示
        if (process.env.NODE_ENV === 'development') {
          childWindow.webContents.openDevTools({ mode: 'detach' });
        }
        // メインウィンドウごとに1回だけリスナーを登録する（リロード時の多重登録を防ぐ）
        if (!isNavigateListenerRegistered) {
          isNavigateListenerRegistered = true;

          // SPA ナビゲーションで createPdf ルートから離れたら previewWindow を閉じる
          senderWindow.webContents.on('did-navigate-in-page', (_event, url) => {
            if (
              !url.includes('createPdf') &&
              previewWindow &&
              !previewWindow.isDestroyed()
            ) {
              closePreviewWindowByOwner();
            }
          });

          // メインウィンドウが閉じた時にプレビューウィンドウも閉じる
          senderWindow.once('closed', () => {
            isNavigateListenerRegistered = false;
            closePreviewWindowByOwner();
          });
        }

        childWindow.on('ready-to-show', () => {
          childWindow.show();
        });

        childWindow.on('closed', () => {
          // renderer 側の previewWindowStatus を即時 CLOSED に更新させる
          if (ownerWindow && !ownerWindow.isDestroyed()) {
            ownerWindow.webContents.send(
              CreatePdfExportChannels.previewWindowClosed,
            );
          }
          previewWindow = null;
          ownerWindow = null;
        });

        childWindow.webContents.setWindowOpenHandler((details) => {
          if (!isSafeExternalUrl(details.url)) {
            console.warn('Blocked external URL:', details.url);
            return { action: 'deny' as const };
          }

          void shell.openExternal(details.url);
          return { action: 'deny' as const };
        });

        await childWindow.loadURL(nextUrl);

        if (isDevelopment) {
          childWindow.webContents.openDevTools({ mode: 'detach' });
        }

        return { ok: true, reused: false };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.closePreviewWindow,
    async (): Promise<CreatePdfExportPreviewWindowCloseResult> => {
      try {
        closePreviewWindowByOwner();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.getPreviewWindowStatus,
    async (): Promise<CreatePdfExportPreviewWindowStatusResult> => {
      try {
        const status = await readBridgeStatus();
        return { ok: true, status };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.requestPreviewUpdate,
    async (
      evt,
      request: CreatePdfExportPreviewUpdateRequest,
    ): Promise<CreatePdfExportPreviewUpdateRequestResult> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(evt.sender);
        if (
          !previewWindow ||
          previewWindow.isDestroyed() ||
          senderWindow !== previewWindow
        ) {
          return {
            ok: false,
            error: 'PreviewWindow からの更新要求ではありません。',
          };
        }

        if (!ownerWindow || ownerWindow.isDestroyed()) {
          return {
            ok: false,
            error: 'プレビュー更新要求の送信先ウィンドウがありません。',
          };
        }

        ownerWindow.webContents.send(
          CreatePdfExportChannels.previewUpdateRequested,
          request,
        );
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.selectOutputDirectory,
    async (
      evt,
      payload?: CreatePdfSelectOutputDirectoryRequest,
    ): Promise<CreatePdfSelectOutputDirectoryResult> => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(evt.sender);
        const dialogOptions: OpenDialogOptions = {
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: payload?.defaultPath ?? undefined,
        };

        const result = senderWindow
          ? await dialog.showOpenDialog(senderWindow, dialogOptions)
          : await dialog.showOpenDialog(dialogOptions);

        return {
          ok: true,
          selectedPath: result.canceled ? null : (result.filePaths[0] ?? null),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.exportPdf,
    async (
      _evt,
      request: CreatePdfExportRequest,
    ): Promise<CreatePdfExportResult> => {
      try {
        if (!request.outputDirectory.trim()) {
          return { ok: false, error: '出力先フォルダを選択してください' };
        }

        const status = await readBridgeStatus();
        if (!status.isOpen) {
          return {
            ok: false,
            error: 'PDF出力用のPreviewWindowが開いていません。',
          };
        }

        if (!status.isReady || status.isRendering) {
          return {
            ok: false,
            error: 'PreviewWindow の描画完了を待ってから再実行してください。',
          };
        }

        if (
          status.creationType !== request.creationType ||
          status.slotKey !== request.slotKey
        ) {
          return {
            ok: false,
            error: 'PreviewWindow に表示中の内容が出力対象と一致しません。',
          };
        }

        /*
        if (status.revision !== request.expectedRevision) {
          return {
            ok: false,
            error:
              'PreviewWindow の revision が最新ではありません。プレビュー更新後に再実行してください。',
          };
        }
        */

        const manifestResult = await readBridgeManifest({
          includeCover: request.includeCover,
          includeMiddleCover: request.includeMiddleCover,
        });
        if (!manifestResult.ok) {
          return { ok: false, error: manifestResult.error };
        }

        const { manifest } = manifestResult;
        if (
          manifest.creationType !== request.creationType ||
          manifest.slotKey !== request.slotKey
          //        ||  manifest.revision !== request.expectedRevision
        ) {
          return {
            ok: false,
            error: 'PreviewWindow manifest が出力要求と一致しません。',
          };
        }

        if (manifest.units.length === 0) {
          return { ok: false, error: '出力対象のページが見つかりません。' };
        }

        const outputFolderPath = join(
          request.outputDirectory,
          `${sanitizePathSegment(manifest.title)}_${formatTimestamp(new Date())}`,
        );

        if (await pathExists(outputFolderPath)) {
          const shouldOverwrite =
            await requestOverwriteConfirmation(outputFolderPath);
          if (!shouldOverwrite) {
            return { ok: false, error: 'PDF出力をキャンセルしました。' };
          }
        }

        await mkdir(outputFolderPath, { recursive: true });

        if (!previewWindow || previewWindow.isDestroyed()) {
          return {
            ok: false,
            error: 'PDF出力中にPreviewWindowが閉じられました。',
          };
        }

        const files: string[] = [];

        await callBridgeSetDisplayMode('patch');

        let originalDocumentTitle: string | null = null;
        try {
          for (const unit of manifest.units) {
            const previousTitle = await callBridgeSetDocumentTitle(
              toPdfDocumentTitle(unit.fileName),
            );
            if (originalDocumentTitle === null && previousTitle !== null) {
              originalDocumentTitle = previousTitle;
            }

            const pageRanges = buildPrintPageRanges(unit);
            const pdfBuffer = await previewWindow.webContents.printToPDF({
              printBackground: true,
              preferCSSPageSize: true,
              margins: { marginType: 'none' },
              ...(pageRanges ? { pageRanges } : {}),
            });
            const filePath = join(
              outputFolderPath,
              sanitizePathSegment(unit.fileName),
            );

            await writeFile(filePath, pdfBuffer);
            files.push(filePath);
          }
        } finally {
          if (originalDocumentTitle !== null) {
            await callBridgeSetDocumentTitle(originalDocumentTitle);
          }
        }

        if (request.conditionJson != null) {
          const jsonFilePath = join(outputFolderPath, '出題条件.json');
          await writeFile(
            jsonFilePath,
            JSON.stringify(request.conditionJson, null, 2),
            'utf-8',
          );
          files.push(jsonFilePath);
        }

        shell.openPath(outputFolderPath);

        return { ok: true, outputFolderPath, files };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        await callBridgeSetDisplayMode('print');
      }
    },
  );

  ipcMain.handle(
    CreatePdfExportChannels.loadConditionJson,
    async (
      _evt,
      request: CreatePdfLoadConditionJsonRequest,
    ): Promise<CreatePdfLoadConditionJsonResult> => {
      try {
        let filePath: string;

        if (request.mode === 'dialog') {
          const dialogWindow =
            ownerWindow && !ownerWindow.isDestroyed() ? ownerWindow : undefined;
          const openOptions: Electron.OpenDialogOptions = {
            title: '出題条件JSONを開く',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
          };
          const result = dialogWindow
            ? await dialog.showOpenDialog(dialogWindow, openOptions)
            : await dialog.showOpenDialog(openOptions);

          if (result.canceled || result.filePaths.length === 0) {
            return {
              ok: false,
              error: 'キャンセルされました。',
              cancelled: true,
            };
          }
          filePath = result.filePaths[0];
        } else {
          filePath = request.filePath;
        }

        const raw = await readFile(filePath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        return { ok: true, json: parsed, filePath };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );
}

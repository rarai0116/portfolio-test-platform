import '@main/services/boostrap';
import '@main/services/loggerBootstrap';
import path, { join } from 'node:path';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { registerAppInfoIpc } from '@main/ipc/appInfo';
import {
  handleFatalStartupError,
  StartupError,
} from '@main/startup/fatalStartup';
import { ASSET_PROTOCOL_SCHEME } from '@shared/types/assets';
import * as dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import icon from '../../../resources/icon.png';
import '@main/ipc/auth.ts';
import '@main/ipc/firestore';
import { initializeAssetStorage } from '@main/ipc/assetStorage';
import { registerCreatePdfExportIpc } from '@main/ipc/createPdfExport';
import { registerCsvFileIpc } from '@main/ipc/csvFile';
import { registerEditorIpc } from '@main/ipc/editor';
import { FirestoreIpcHandlers } from '@main/ipc/firestore';
import { CacheDao } from '@main/ipc/firestore/cacheDao';
import { FirebaseFirestoreClient } from '@main/ipc/firestore/clients';
import { OutboxManager } from '@main/ipc/firestore/outbox';
import { registerPdfPreviewIpc } from '@main/ipc/pdfPreview';
import { registerPreviewIpc } from '@main/ipc/preview';
import { registerTestCategoryIpc } from '@main/ipc/testCategory';
import { TestCategoryClient } from '@main/ipc/testCategory/client';
import { TestCategoryDB } from '@main/ipc/testCategory/db';
import { registerUpdaterIpc } from '@main/ipc/updater';
import { isSafeExternalUrl } from '@main/services/externalUrl';
import { firestore } from '@main/services/firebase';
import { startRendererServer } from '@main/services/localServer';
import { setRendererBaseUrl } from '@main/services/rendererBase';
import { telemetryService } from '@main/services/telemetry';
import { memoryProbe } from '@main/services/telemetry/memoryProbe';
import { attachWindowTelemetry } from '@main/services/telemetry/windowMonitor';
import { FirestoreCacheManager } from './ipc/firestore/cacheManager';
import { FirestoreIndexMutationExecutor } from './ipc/firestore/mutationExecutor';

const envPath = app.isPackaged
  ? path.join(process.resourcesPath, 'env/.env.prod')
  : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// エージェントが起動済みアプリへ CDP でアタッチするためのポート。
// ポート番号はコードに持たず .env の demo_UI_AGENT_PORT でのみ指定し、未設定なら開かない。
// 配布ビルドでは常に無効。demo_UI_AGENT_ACTIVE は preload 側のマーカー公開条件を
// ここでの判定と一致させるために立てる。
const uiAgentPort = process.env.demo_UI_AGENT_PORT;
if (!app.isPackaged && uiAgentPort) {
  app.commandLine.appendSwitch('remote-debugging-port', uiAgentPort);
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  process.env.demo_UI_AGENT_ACTIVE = '1';
}

const isDevelopment = process.env.NODE_ENV === 'development';

/*
if (isDevelopment) {
  console.log('Development mode: enabling electron-reload');
  // electron-reload を設定
  require('electron-reload')(path.join(__dirname, '../..'), {
    electron: path.join(__dirname, '../../node_modules/.bin/electron'),
    awaitWriteFinish: true,
  });
}
*/

let rendererBaseUrl = process.env.ELECTRON_RENDERER_URL;
setRendererBaseUrl(rendererBaseUrl);
let stopServer: (() => Promise<void>) | undefined;

// ready前の同期登録はトップレベルのtry/catchで囲み、失敗を保持して
// app.whenReady() 解決直後に共通の起動失敗処理へ流す（設計3.5 / 4.2）。
let preReadyStartupError: unknown = null;
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_PROTOCOL_SCHEME,
      privileges: { secure: true, stream: true, supportFetchAPI: true },
    },
  ]);
} catch (e) {
  preReadyStartupError = new StartupError(
    'scheme-register',
    'failed to register demo-asset scheme as privileged',
    { cause: e },
  );
}

async function createWindow(
  cacheManager: FirestoreCacheManager,
  client: FirebaseFirestoreClient,
  mutationExecutor: FirestoreIndexMutationExecutor,
): Promise<BrowserWindow> {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDevelopment,
    },
  });
  attachWindowTelemetry(mainWindow, 'main');
  memoryProbe.attachWindow(mainWindow);
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (!isSafeExternalUrl(details.url)) {
      console.warn('Blocked external URL:', details.url);
      return { action: 'deny' };
    }

    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // アセットルート検証・AssetDB open・protocol／IPC登録が完了してから
  // rendererを読み込む（設計4.2）。失敗時はsingletonを公開せずfail-fastする。
  await initializeAssetStorage({
    mainWindow,
    cacheManager,
    client,
    executor: mutationExecutor,
  });

  // エディタ IPC 登録
  registerEditorIpc(mainWindow);
  // プレビュー IPC 登録
  registerPreviewIpc();
  // PDF作成プレビュー IPC 登録
  registerPdfPreviewIpc();
  // PDF作成 PreviewWindow 出力 IPC 登録
  registerCreatePdfExportIpc();
  // アップデータ IPC 登録
  registerUpdaterIpc(mainWindow);
  // CSVファイル IPC 登録
  registerCsvFileIpc(mainWindow);

  return mainWindow;
}

/** IPC登録がすべて終わってからrendererを読み込む（設計4.2） */
async function loadRenderer(
  mainWindow: BrowserWindow,
  entry: string,
): Promise<void> {
  if (entry.startsWith('http')) {
    await mainWindow.loadURL(entry);
  } else {
    await mainWindow.loadFile(entry);
  }
}

app
  .whenReady()
  .then(async () => {
    if (preReadyStartupError) {
      // ready前に保持したscheme登録エラーも同じ共通処理へ流す（設計3.5）。
      throw preReadyStartupError;
    }

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');
    telemetryService.startSession();
    telemetryService.registerIpcHandlers();
    telemetryService.installProcessHandlers();
    memoryProbe.start();

    if (!is.dev) {
      const { origin, stop } = await startRendererServer(
        join(__dirname, '../renderer'),
      );
      rendererBaseUrl = origin;
      setRendererBaseUrl(rendererBaseUrl);
      stopServer = stop;
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
      memoryProbe.attachWindow(window);
    });

    app.on('child-process-gone', (_event, details) => {
      telemetryService.captureChildProcessGone(
        details as unknown as Record<string, unknown>,
      );
    });

    // IPC test
    ipcMain.on('ping', () => {
      console.log('pong');
    });

    registerAppInfoIpc();

    const cacheDao = new CacheDao();
    await cacheDao.init();

    const client = new FirebaseFirestoreClient(firestore);
    const outbox = new OutboxManager();
    const cacheManager = new FirestoreCacheManager(cacheDao, client);
    const mutationExecutor = new FirestoreIndexMutationExecutor(client);

    const mainWindow = await createWindow(
      cacheManager,
      client,
      mutationExecutor,
    );

    const firestoreIpc = new FirestoreIpcHandlers(
      client,
      outbox,
      cacheDao,
      cacheManager,
      mutationExecutor,
    );
    firestoreIpc.register();

    const testCategoryDbPath = path.join(
      app.getPath('userData'),
      'testCategory.db',
    );
    const testCategoryDb = new TestCategoryDB(testCategoryDbPath);
    const testCategoryClient = new TestCategoryClient(
      testCategoryDb,
      cacheManager,
    );
    registerTestCategoryIpc(testCategoryClient);

    await loadRenderer(
      mainWindow,
      rendererBaseUrl ?? join(__dirname, '../renderer/index.html'),
    );

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // macOSのwindow再生成では、AssetManagerとSQLite接続を作り直さず通知先だけ更新する。
        void createWindow(cacheManager, client, mutationExecutor)
          .then((recreated) =>
            loadRenderer(
              recreated,
              rendererBaseUrl ?? join(__dirname, '../renderer/index.html'),
            ),
          )
          .catch((error) => {
            // 起動後のwindow再生成失敗はアプリ終了へ昇格させない。
            console.error('Failed to recreate window:', error);
          });
      }
    });
  })
  // 起動Promise内の未処理例外だけを共通のfatal処理へ渡す（設計4.2）。
  .catch(handleFatalStartupError);

app.on('window-all-closed', () => {
  const wins = BrowserWindow.getAllWindows();
  console.log('[window-all-closed] 残ウィンドウ数:', wins.length);
  wins.forEach((w) => {
    console.log(
      '  - id:',
      w.id,
      'title:',
      w.getTitle(),
      'url:',
      w.webContents.getURL(),
    );
  });
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.once('will-quit', () => {
  memoryProbe.stop();
  telemetryService.markCleanExit();
  stopServer?.().catch((err) =>
    console.error('Failed to stop renderer server', err),
  );
});

import path, { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { auth, ensureAuthClaims, functions } from '@main/services/firebase';
import { getMainScope } from '@main/services/loggerCore';
import { getRendererBaseUrl } from '@main/services/rendererBase';
import { attachWindowTelemetry } from '@main/services/telemetry/windowMonitor';
import * as dotenv from 'dotenv';
import { app, BrowserWindow, ipcMain } from 'electron';
import type { ParsedToken } from 'firebase/auth';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { shouldUseLocalAuthEmulator } from './authRuntimePolicy';

const log = getMainScope('auth');

type AuthErrorCode =
  | 'claims-missing'
  | 'internal-error'
  | 'popup-blocked'
  | 'popup-closed-by-user'
  | 'popup-failed'
  | 'popup-request-cancelled'
  | 'replaced'
  | 'window-closed';

type AuthPopupResultPayload = {
  attemptId?: string;
  ok?: boolean;
  idToken?: string;
  accessToken?: string;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
};

type AuthSessionResult = {
  idToken: string;
  claims: ParsedToken;
  accessToken?: string;
};

type SetCustomClaimsResponse = {
  success?: boolean;
  message?: string;
};

type ActiveAuthSession = {
  attemptId: string;
  window: BrowserWindow;
  settled: boolean;
  closedBySystem: boolean;
  resolve: (value: AuthSessionResult) => void;
  reject: (reason?: unknown) => void;
  popupResultHandler: (
    event: Electron.IpcMainEvent,
    payload: AuthPopupResultPayload,
  ) => void;
};

// .envファイルを読み込む
const envPath = process.env.DOTENV_CONFIG_PATH;
dotenv.config(envPath ? { path: envPath } : undefined);
log.warn('Auth IPC loaded', process.env.NODE_ENV);
let loginWindow: BrowserWindow | null = null;
let activeAuthSession: ActiveAuthSession | null = null;
let authAttemptSequence = 0;

const isDevelopment = process.env.NODE_ENV === 'development';
const useLocalAuthEmulator = shouldUseLocalAuthEmulator({
  isPackaged: app.isPackaged,
  useFirebaseEmulator: process.env.USE_FIREBASE_EMULATOR,
});
if (useLocalAuthEmulator) {
  dotenv.config({
    path: path.resolve(process.cwd(), '.env.development'),
    override: false,
  });
}

if (isDevelopment && app.isPackaged) {
  console.log('Development mode: enabling electron-reload');
  // electron-reload を設定
  require('electron-reload')(path.join(__dirname, '../..'), {
    electron: path.join(__dirname, '../../node_modules/.bin/electron'),
    awaitWriteFinish: true,
  });
}

const resolveAuthUrl = (attemptId?: string) => {
  const base = getRendererBaseUrl();
  const suffix = attemptId
    ? `#/auth?attemptId=${encodeURIComponent(attemptId)}`
    : '#/auth';
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}${suffix}`;
  }
  if (base?.startsWith('http')) {
    return `${base}${suffix}`;
  }
  return `file://${join(__dirname, '../renderer/index.html')}${suffix}`;
};

const createAuthError = (code: AuthErrorCode, message: string): Error => {
  const error = new Error(message) as Error & { code?: AuthErrorCode };
  error.code = code;
  return error;
};

const getAuthErrorCode = (error: unknown): AuthErrorCode => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code as AuthErrorCode;
  }

  return 'internal-error';
};

const hasRequiredClaims = (claims?: ParsedToken | null) => {
  return !!(claims?.atpAllowWrite || claims?.atpAllowRead);
};

const signOutForRetry = async (reason: string) => {
  if (!auth.currentUser) {
    return;
  }

  try {
    await signOut(auth);
  } catch (error: unknown) {
    log.warn(`Failed to sign out after ${reason}:`, error);
  }
};

const requestCustomClaimsAndEnsure = async () => {
  const setCustomClaims = httpsCallable<
    Record<string, never>,
    SetCustomClaimsResponse
  >(functions, 'setCustomClaims');
  const response = await setCustomClaims({});
  const result = response.data;

  if (result?.success === false) {
    throw createAuthError(
      'claims-missing',
      result.message ?? '権限がありません（カスタムクレーム未付与）',
    );
  }

  await ensureAuthClaims({
    requireRead: true,
    timeoutMs: 15_000,
  });
};

const ensureSignedInUserClaims = async () => {
  let result = await auth.currentUser?.getIdTokenResult(true);

  if (!hasRequiredClaims(result?.claims)) {
    console.log(
      'User lacks required claims, attempting to set custom claims via Cloud Function',
    );
    await requestCustomClaimsAndEnsure();
    result = await auth.currentUser?.getIdTokenResult(true);
  }

  const finalClaims = result?.claims ?? {};
  if (!hasRequiredClaims(finalClaims)) {
    throw createAuthError(
      'claims-missing',
      '権限がありません（カスタムクレーム未付与）',
    );
  }

  return finalClaims;
};

const signInWithLocalAuthEmulator = async () => {
  const email = process.env.LOCAL_AUTH_EMAIL;
  const subject = process.env.LOCAL_AUTH_SUBJECT;
  if (!email || !subject) {
    throw new Error('Local Auth Emulator account is not configured');
  }

  const mockIdToken = JSON.stringify({
    sub: subject,
    email,
    email_verified: true,
  });
  const credential = GoogleAuthProvider.credential(mockIdToken);

  await signInWithCredential(auth, credential);
  await ensureSignedInUserClaims();
  log.info('Signed in with local Auth Emulator account', email);
};

const closeAuthWindow = (session: ActiveAuthSession) => {
  if (session.window.isDestroyed()) {
    return;
  }

  session.closedBySystem = true;
  try {
    session.window.close();
  } catch (error: unknown) {
    log.error('Failed to close login window:', error);
  }
};

const finalizeAuthSession = (attemptId: string) => {
  const session = activeAuthSession;
  if (!session || session.attemptId !== attemptId) {
    return;
  }

  ipcMain.removeListener('auth:popup-result', session.popupResultHandler);
  activeAuthSession = null;
  if (loginWindow === session.window) {
    loginWindow = null;
  }
  closeAuthWindow(session);
};

const settleAuthSession = (
  attemptId: string,
  outcome:
    | { type: 'resolve'; value: AuthSessionResult }
    | { type: 'reject'; error: Error },
) => {
  const session = activeAuthSession;
  if (!session || session.attemptId !== attemptId) {
    return;
  }
  if (session.settled) {
    finalizeAuthSession(attemptId);
    return;
  }

  session.settled = true;
  if (outcome.type === 'resolve') {
    session.resolve(outcome.value);
  } else {
    session.reject(outcome.error);
  }

  finalizeAuthSession(attemptId);
};

const cancelActiveAuthSession = (code: AuthErrorCode, message: string) => {
  const session = activeAuthSession;
  if (!session) {
    return;
  }

  settleAuthSession(session.attemptId, {
    type: 'reject',
    error: createAuthError(code, message),
  });
};

const stripHashAndSearch = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return rawUrl.split('#')[0]?.split('?')[0] ?? rawUrl;
  }
};

const isAuthDocumentResponse = (
  requestUrl: string,
  authUrl: string,
): boolean => {
  return stripHashAndSearch(requestUrl) === stripHashAndSearch(authUrl);
};

const buildAuthPopupCsp = (development: boolean): string => {
  const connectSrc = development
    ? [
        "'self'",
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://oauth2.googleapis.com',
        'https://www.googleapis.com',
        'https://apis.google.com',
        'https://*.google.com',
        'https://*.gstatic.com',
        'http://127.0.0.1:9099',
        'http://127.0.0.1:5001',
        'ws://127.0.0.1:*',
      ]
    : [
        "'self'",
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://oauth2.googleapis.com',
        'https://www.googleapis.com',
        'https://apis.google.com',
        'https://*.google.com',
        'https://*.gstatic.com',
      ];

  const scriptSrc = development
    ? [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://apis.google.com',
        'https://accounts.google.com',
        'https://*.gstatic.com',
      ]
    : [
        "'self'",
        'https://apis.google.com',
        'https://accounts.google.com',
        'https://*.gstatic.com',
      ];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.gstatic.com https://*.googleusercontent.com https://*.google.com https://*.ytimg.com",
    `connect-src ${connectSrc.join(' ')}`,
    'frame-src https://accounts.google.com https://*.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.web.app https://*.googleusercontent.com https://accounts.youtube.com https://*.youtube.com',
    "child-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');
};

const openLoginPopup = (): Promise<AuthSessionResult> =>
  new Promise((resolve, reject) => {
    cancelActiveAuthSession(
      'replaced',
      '新しいログイン要求で前回の認証をキャンセルしました。',
    );

    const attemptId = `auth-${Date.now()}-${++authAttemptSequence}`;

    const authWindow = new BrowserWindow({
      width: 480,
      height: 640,
      minWidth: 400,
      resizable: false,
      modal: false,
      show: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: isDevelopment,
      },
    });

    authWindow.removeMenu();

    loginWindow = authWindow;
    attachWindowTelemetry(authWindow, 'auth');

    authWindow.webContents.setWindowOpenHandler(() => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
        },
      };
    });

    authWindow.webContents.on('did-create-window', (childWindow) => {
      childWindow.removeMenu();
    });

    //　devtoolsを表示
    if (process.env.NODE_ENV === 'development') {
      authWindow.webContents.openDevTools({ mode: 'detach' });
    }
    // --- デバッグ: アプリへ戻るリダイレクトを一時停止 -------------------------
    // DEBUG_AUTH_REDIRECT=1 の時のみ有効化
    if (process.env.DEBUG_AUTH_REDIRECT === '1') {
      console.log(
        '[auth-debug] DEBUG_AUTH_REDIRECT is enabled: blocking redirects back to app',
      );
      // アプリ側のベースURL（戻り先）を計算
      const appBase =
        is.dev && process.env.ELECTRON_RENDERER_URL
          ? process.env.ELECTRON_RENDERER_URL // 例: http://127.0.0.1:5173
          : `file://${join(__dirname, '../renderer/index.html')}`;

      const isBackToApp = (targetUrl: string) => {
        // ハッシュの違いは無視して、先頭一致で判定
        // file:// と http(s):// の両方に対応
        return targetUrl.startsWith(appBase.replace(/#.*$/, ''));
      };

      // リダイレクトでアプリに戻ろうとしたらブロック
      authWindow.webContents.on('will-redirect', (event, targetUrl) => {
        if (isBackToApp(targetUrl)) {
          log.warn('[auth-debug] Block will-redirect back to app:', targetUrl);
          event.preventDefault();
        }
      });
      // location 変更タイプのナビゲーションでも同様にブロック
      authWindow.webContents.on('will-navigate', (event, targetUrl) => {
        if (isBackToApp(targetUrl)) {
          log.warn('[auth-debug] Block will-navigate back to app:', targetUrl);
          event.preventDefault();
        }
      });

      // 画面のコンソール出力をメインに転送（エラー観測しやすく）
      authWindow.webContents.on(
        'console-message',
        (_e, level, message, line, sourceId) => {
          const lvl = ['LOG', 'WARN', 'ERROR'][level] ?? 'LOG';
          log.warn(`[auth-debug][${lvl}] ${sourceId}:${line} ${message}`);
        },
      );
      // ロード失敗時の詳細
      authWindow.webContents.on(
        'did-fail-load',
        (_e, errorCode, errorDesc, validatedURL) => {
          log.warn('[auth-debug] did-fail-load:', {
            errorCode,
            errorDesc,
            validatedURL,
          });
        },
      );
      authWindow.webContents.on('did-navigate', (_e, url) => {
        log.warn('[auth-debug] did-navigate:', url);
      });
    }
    const url = resolveAuthUrl(attemptId);
    /*
    const url =
      is.dev && process.env.ELECTRON_RENDERER_URL
        ? `${process.env.ELECTRON_RENDERER_URL}#/auth`
        : `file://${join(__dirname, '../renderer/index.html')}#/auth`;
      */
    authWindow.webContents.session.webRequest.onHeadersReceived(
      (details, callback) => {
        if (!isAuthDocumentResponse(details.url, url)) {
          callback({ responseHeaders: details.responseHeaders });
          return;
        }

        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [buildAuthPopupCsp(isDevelopment)],
          },
        });
      },
    );

    const popupResultHandler = async (
      _evt: Electron.IpcMainEvent,
      payload: AuthPopupResultPayload,
    ) => {
      if (activeAuthSession?.attemptId !== attemptId) {
        return;
      }
      if (!payload?.attemptId || payload.attemptId !== attemptId) {
        return;
      }

      if (!payload.ok || !payload.idToken) {
        settleAuthSession(attemptId, {
          type: 'reject',
          error: createAuthError(
            payload.errorCode ?? 'popup-failed',
            payload.errorMessage ?? 'Google ログインに失敗しました。',
          ),
        });
        return;
      }

      try {
        const credential = GoogleAuthProvider.credential(
          payload.idToken,
          payload.accessToken ?? undefined,
        );
        await signInWithCredential(auth, credential);
        if (activeAuthSession?.attemptId !== attemptId) {
          return;
        }
        console.info('User signed in with Google credential from popup');

        const finalClaims = await ensureSignedInUserClaims();
        if (activeAuthSession?.attemptId !== attemptId) {
          return;
        }

        if (!auth.currentUser) {
          throw createAuthError(
            'internal-error',
            '認証に失敗しました（currentUser is null）',
          );
        }

        const idTokenLatest = await auth.currentUser.getIdToken(true);
        if (activeAuthSession?.attemptId !== attemptId) {
          return;
        }

        settleAuthSession(attemptId, {
          type: 'resolve',
          value: {
            idToken: idTokenLatest,
            claims: finalClaims,
            accessToken: payload.accessToken,
          },
        });
      } catch (error: unknown) {
        console.error('Error during auth popup handling:', error);
        if (activeAuthSession?.attemptId !== attemptId) {
          return;
        }

        await signOutForRetry('authorization failure');

        const authError =
          error instanceof Error
            ? error
            : createAuthError('internal-error', String(error));

        settleAuthSession(attemptId, {
          type: 'reject',
          error: authError,
        });
      }
    };

    activeAuthSession = {
      attemptId,
      window: authWindow,
      settled: false,
      closedBySystem: false,
      resolve,
      reject,
      popupResultHandler,
    };

    ipcMain.on('auth:popup-result', popupResultHandler);

    authWindow.webContents.session.clearCache().then(() => {
      if (!activeAuthSession || activeAuthSession.attemptId !== attemptId) {
        return reject(new Error('Login window not available'));
      }
      authWindow.loadURL(url).catch((error) => {
        settleAuthSession(attemptId, {
          type: 'reject',
          error: createAuthError('internal-error', String(error)),
        });
      });
    });

    // 認証ウィンドウが閉じられたら reject
    authWindow.on('closed', () => {
      if (loginWindow === authWindow) {
        loginWindow = null;
      }

      if (activeAuthSession?.attemptId !== attemptId) {
        return;
      }

      if (activeAuthSession.closedBySystem || activeAuthSession.settled) {
        return;
      }

      settleAuthSession(attemptId, {
        type: 'reject',
        error: createAuthError(
          'window-closed',
          'ログインウィンドウが閉じられました。',
        ),
      });
    });
  });

const readClaims = async (refresh = true) => {
  const u = auth.currentUser;
  if (!u) return { signedIn: false, hasClaims: false as const };

  const r = await u.getIdTokenResult(refresh);
  const hasClaims = !!(r.claims?.atpAllowWrite || r.claims?.atpAllowRead);
  return {
    signedIn: true as const,
    hasClaims,
    claims: r.claims,
    uid: u.uid,
    email: u.email ?? undefined,
  };
};

ipcMain.handle('auth:signInWithGoogle', async () => {
  try {
    if (useLocalAuthEmulator) {
      await signInWithLocalAuthEmulator();
    } else {
      await openLoginPopup(); // ここでサインイン＋必要ならクレーム付与まで実施済み
    }
    const info = await readClaims(true);
    return { ok: true, ...info }; // { ok, signedIn, hasClaims, claims, uid, email }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, errorCode: getAuthErrorCode(e) };
  }
});

ipcMain.handle('auth:signOut', async () => {
  try {
    await signOut(auth);
    return { ok: true, signedIn: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
});

ipcMain.handle(
  'auth:hasRequiredClaims',
  async (_evt, opts?: { refresh?: boolean; ensure?: boolean }) => {
    try {
      let info = await readClaims(opts?.refresh ?? true);

      if (!info.signedIn) {
        return { ok: true, ...info };
      }

      if (!info.hasClaims && opts?.ensure) {
        await requestCustomClaimsAndEnsure();
        info = await readClaims(true); // 強制リフレッシュ
      }

      return { ok: true, ...info };
    } catch (e) {
      await signOutForRetry('claim verification failure');
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg, errorCode: getAuthErrorCode(e) };
    }
  },
);

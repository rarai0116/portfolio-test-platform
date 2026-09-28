import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

const LOGIN_RETRY_INTERVAL_MS = 5000;

const formatAuthErrorMessage = (
  errorCode?: string,
  fallbackMessage?: string,
) => {
  switch (errorCode) {
    case 'popup-blocked':
      return 'Google ログインのポップアップがブロックされました。ポップアップ許可設定を確認してください。';
    case 'popup-closed-by-user':
      return 'Google ログインがキャンセルされました。もう一度お試しください。';
    case 'popup-request-cancelled':
      return '前回のログイン処理をキャンセルしました。もう一度お試しください。';
    case 'window-closed':
      return 'ログイン処理が中断されました。もう一度お試しください。';
    case 'claims-missing':
      return '権限がありません。再度ログインをお試し頂くか、別のアカウントをご利用ください。';
    default:
      return (
        fallbackMessage ??
        '権限がありません。再度ログインをお試し頂くか、別のアカウントをご利用ください。'
      );
  }
};

const Login = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canRetryLogin, setCanRetryLogin] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const loginRequestIdRef = useRef(0);
  const latestLoginRequestIdRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isDisposed = false;

    const loadAppInfo = async () => {
      const result = await window.appInfo.get().catch((error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      }));

      if (isDisposed || !result.ok || !result.isPackaged) {
        return;
      }

      setAppVersion(result.version);
    };

    void loadAppInfo();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const moveFromLogin = useCallback(
    (isDev?: boolean) => {
      if (import.meta.env.DEV && isDev) {
        // 開発用画面へ
        navigate('/__dev');
        return;
      }

      navigate('/testDataList');
    },
    [navigate],
  );
  const onClickLogin = useCallback(
    async (isDev?: boolean) => {
      if (!canRetryLogin) {
        return;
      }

      const requestId = ++loginRequestIdRef.current;
      latestLoginRequestIdRef.current = requestId;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      setCanRetryLogin(false);
      retryTimerRef.current = setTimeout(() => {
        setCanRetryLogin(true);
        retryTimerRef.current = null;
      }, LOGIN_RETRY_INTERVAL_MS);

      setErrorMsg(null);
      setLoading(true);

      try {
        // 1) 既存セッション＋クレームOKなら即遷移（ポップアップ開かない）
        console.log('Checking existing session...');
        const pre = await window.electron.ipcRenderer
          .invoke('auth:hasRequiredClaims', { refresh: true }) // ensure:false
          .catch((e: unknown) => ({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }));

        if (pre?.ok && pre.signedIn && pre.hasClaims) {
          if (latestLoginRequestIdRef.current !== requestId) {
            return;
          }
          moveFromLogin(isDev);
          return;
        }

        // 2) 未ログイン or クレーム未付与 → サインイン（メイン側で付与も実施）
        const res = await window.electron.ipcRenderer
          .invoke('auth:signInWithGoogle')
          .catch((e: unknown) => ({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }));

        if (res?.ok && res.signedIn && res.hasClaims) {
          if (latestLoginRequestIdRef.current !== requestId) {
            return;
          }
          moveFromLogin(isDev);
          return;
        }

        // 3) 念のため ensure=true で最終確認（付与リトライ）
        const ensure = await window.electron.ipcRenderer
          .invoke('auth:hasRequiredClaims', { refresh: true, ensure: true })
          .catch((e: unknown) => ({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }));

        if (ensure?.ok && ensure.signedIn && ensure.hasClaims) {
          if (latestLoginRequestIdRef.current !== requestId) {
            return;
          }
          moveFromLogin(isDev);
        } else {
          if (latestLoginRequestIdRef.current !== requestId) {
            return;
          }
          setErrorMsg(
            formatAuthErrorMessage(
              ensure?.errorCode ?? res?.errorCode,
              ensure?.error ?? res?.error,
            ),
          );
        }
      } finally {
        if (latestLoginRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [canRetryLogin, moveFromLogin],
  );

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {import.meta.env.DEV && (
        <div className="absolute top-4 right-4">
          <button
            className="gsi-material-button"
            type="button"
            onClick={() => onClickLogin(true)}
            disabled={!canRetryLogin}
          >
            テスト画面へログイン
          </button>
        </div>
      )}
      <div className="text-primary text-[40px] font-bold pb-15">
        Test Manager
      </div>

      <div className="text-foreground text-lg pb-3">
        Googleアカウントでログイン
      </div>

      {errorMsg ? (
        <div className="text-error-text pb-3" role="alert" aria-live="polite">
          {errorMsg}
        </div>
      ) : null}
      <button
        className="gsi-material-button"
        type="button"
        onClick={() => onClickLogin()}
        disabled={!canRetryLogin}
        aria-busy={loading}
      >
        <div className="gsi-material-button-state"></div>
        <div className="gsi-material-button-content-wrapper">
          <div className="gsi-material-button-icon">
            <svg
              role="img"
              aria-labelledby="gsi-google-title"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="block"
              aria-label="Google Logo"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              ></path>
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              ></path>
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              ></path>
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              ></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          </div>
          <span className="gsi-material-button-contents">
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </span>
        </div>
      </button>

      {appVersion ? (
        <div className="absolute right-4 bottom-4 text-xs text-muted">
          Version: {appVersion}
        </div>
      ) : null}
    </div>
  );
};

export default Login;

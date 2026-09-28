import { auth } from '@renderer/api/firebase.ts';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import '@styles/main.css';
import { useEffect, useRef } from 'react';

type PopupErrorCode =
  | 'internal-error'
  | 'popup-blocked'
  | 'popup-closed-by-user'
  | 'popup-failed'
  | 'popup-request-cancelled';

type PopupResultPayload = {
  attemptId: string;
  ok: boolean;
  idToken?: string;
  accessToken?: string;
  errorCode?: PopupErrorCode;
  errorMessage?: string;
};

const GoogleAuthPopup = () => {
  const runningRef = useRef(false); // 二重実行ガード

  const getAttemptId = () => {
    const hash = window.location.hash ?? '';
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
    return new URLSearchParams(query).get('attemptId') ?? '';
  };

  const toPopupError = (
    err: unknown,
  ): { code: PopupErrorCode; message: string } => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String(err.code)
        : undefined;

    switch (code) {
      case 'auth/popup-closed-by-user':
        return {
          code: 'popup-closed-by-user',
          message:
            'ポップアップがユーザー操作で閉じられました。もう一度お試しください。',
        };
      case 'auth/cancelled-popup-request':
        return {
          code: 'popup-request-cancelled',
          message:
            '前回のポップアップ処理をキャンセルしました。再度お試しください。',
        };
      case 'auth/popup-blocked':
        return {
          code: 'popup-blocked',
          message:
            'ポップアップがブロックされました。ポップアップ許可設定を確認してください。',
        };
      case 'auth/operation-not-allowed':
        return {
          code: 'popup-failed',
          message:
            'このサインイン方法はプロジェクトで許可されていません（Firebaseコンソールで有効化してください）。',
        };
      default:
        return {
          code: 'internal-error',
          message:
            (err instanceof Error ? err.message : String(err)) ??
            '不明なエラーが発生しました。',
        };
    }
  };

  const sendResult = (payload: PopupResultPayload) => {
    window.electron.ipcRenderer.send('auth:popup-result', payload);
  };

  const signIn = async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    const attemptId = getAttemptId();
    if (!attemptId) {
      sendResult({
        attemptId: '',
        ok: false,
        errorCode: 'internal-error',
        errorMessage: '認証試行の識別子がありません。',
      });
      return;
    }

    try {
      await signOut(auth).catch(() => undefined);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      const cred = GoogleAuthProvider.credentialFromResult(result);
      const idToken = cred?.idToken ?? undefined;
      const accessToken = cred?.accessToken ?? undefined;

      sendResult({
        attemptId,
        ok: true,
        idToken,
        accessToken,
      });
    } catch (e: unknown) {
      const popupError = toPopupError(e);
      console.warn('Google sign-in failed:', e);

      sendResult({
        attemptId,
        ok: false,
        errorCode: popupError.code,
        errorMessage: popupError.message,
      });
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時に一度だけ実行
  useEffect(() => {
    void signIn(); // マウント時に一度だけ実行
  }, []);

  return (
    <div className="p-4 text-foreground">
      <div className="text-sm opacity-80">Google 認証を開始しています…</div>
    </div>
  );
};

export default GoogleAuthPopup;

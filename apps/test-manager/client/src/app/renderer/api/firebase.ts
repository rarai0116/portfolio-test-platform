import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithPopup,
} from 'firebase/auth';
import { cordovaPopupRedirectResolver } from 'firebase/auth/cordova';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const isFileProtocol = window.location.protocol === 'file:';
const resolver = isFileProtocol
  ? cordovaPopupRedirectResolver
  : browserPopupRedirectResolver;

// console.log('Firebase import.meta.env:', import.meta.env);
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '127.0.0.1',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app',
};

// HMR 耐性: 既に初期化済みなら再利用
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth を一度だけ initializeAuth で作成し、グローバルに保持
const auth =
  // biome-ignore lint/suspicious/noExplicitAny: グローバルに保存
  (globalThis as any).__FIREBASE_AUTH__ ??
  initializeAuth(app, {
    persistence: [
      browserSessionPersistence,
      indexedDBLocalPersistence,
      browserLocalPersistence,
    ],
    popupRedirectResolver: resolver,
  });
// biome-ignore lint/suspicious/noExplicitAny: グローバルに保存
(globalThis as any).__FIREBASE_AUTH__ = auth;

// Functions（必要ならリージョン指定）
const functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_REGION ?? 'asia-northeast1',
);

// Emulator（本番検証時は OFF 推奨）
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.log('[renderer] Connecting to Firebase Emulators...');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { app, auth, functions, GoogleAuthProvider, signInWithPopup };

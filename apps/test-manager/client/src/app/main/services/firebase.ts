import path from 'node:path';
import * as dotenv from 'dotenv';
import { app as electronApp } from 'electron';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const envPath =
  process.env.DOTENV_CONFIG_PATH ??
  (electronApp?.isPackaged
    ? path.join(process.resourcesPath, 'env/.env.prod')
    : path.resolve(process.cwd(), '.env'));
dotenv.config({ path: envPath });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

const region =
  process.env.FIREBASE_REGION ||
  process.env.VITE_FIREBASE_REGION ||
  'asia-northeast1';

const firestore = getFirestore(app);
const functions = getFunctions(app, region);
if (process.env.USE_FIREBASE_EMULATOR === 'true') {
  console.log('Connecting to Firebase Emulators...');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

type ClaimsSnapshot = {
  hasRead: boolean;
  hasWrite: boolean;
  expiresAtMs: number;
};

const CLAIMS_CACHE_SKEW_MS = 60_000;
let claimsCache: ClaimsSnapshot | null = null;

const hasRequiredClaims = (
  snapshot: ClaimsSnapshot,
  opts?: {
    requireRead?: boolean;
    requireWrite?: boolean;
  },
) => {
  const needsRead = !!opts?.requireRead;
  const needsWrite = !!opts?.requireWrite;

  const readOk = !needsRead || snapshot.hasRead;
  const writeOk = !needsWrite || snapshot.hasWrite;

  return readOk && writeOk;
};

const getValidClaimsCache = () => {
  if (!claimsCache) return null;
  if (Date.now() >= claimsCache.expiresAtMs) {
    claimsCache = null;
    return null;
  }
  return claimsCache;
};

const readClaimsSnapshot = async (
  forceRefresh: boolean,
): Promise<ClaimsSnapshot> => {
  if (!auth.currentUser) {
    throw new Error('Auth lost: currentUser is null');
  }

  const result = await auth.currentUser.getIdTokenResult(forceRefresh);
  const claims = result.claims ?? {};

  const expirationTimeMs = Date.parse(result.expirationTime);
  const expiresAtMs =
    Number.isFinite(expirationTimeMs) && expirationTimeMs > Date.now()
      ? Math.max(Date.now() + 1_000, expirationTimeMs - CLAIMS_CACHE_SKEW_MS)
      : Date.now();

  const snapshot: ClaimsSnapshot = {
    hasRead: !!(claims.atpAllowRead || claims.atpAllowWrite),
    hasWrite: !!claims.atpAllowWrite,
    expiresAtMs,
  };

  claimsCache = snapshot;
  return snapshot;
};

export async function ensureAuthClaims(opts?: {
  requireRead?: boolean;
  requireWrite?: boolean;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const start = Date.now();

  if (!auth.currentUser) {
    await new Promise<void>((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        claimsCache = null;
        if (u) {
          unsub();
          resolve();
        }
      });

      const t = setInterval(() => {
        if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          try {
            unsub();
          } catch {}
          reject(new Error('Auth timeout: user not signed in'));
        }
      }, 250);
    });
  }

  const cached = getValidClaimsCache();
  if (cached && hasRequiredClaims(cached, opts)) {
    return;
  }

  while (true) {
    if (!auth.currentUser) {
      claimsCache = null;
      throw new Error('Auth lost: user signed out during claim wait');
    }

    const normalSnapshot = await readClaimsSnapshot(false);
    if (hasRequiredClaims(normalSnapshot, opts)) {
      return;
    }

    const refreshedSnapshot = await readClaimsSnapshot(true);
    if (hasRequiredClaims(refreshedSnapshot, opts)) {
      return;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('Auth timeout: required custom claims not present');
    }

    await new Promise((res) => setTimeout(res, 500));
  }
}

export { auth, firestore, functions, storage };

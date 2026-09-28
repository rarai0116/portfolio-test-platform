import fs from 'node:fs';
import path from 'node:path';
import type { Bucket } from '@google-cloud/storage';
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// テスト検知とパス基点の固定
const isTest =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  typeof process.env.VITEST_WORKER_ID !== 'undefined';

// admin.ts は functions/src にあるため、apps/backend を基点にする
const backendRoot = path.resolve(__dirname, '..', '..'); // apps/backend
const functionsRoot = path.join(backendRoot, 'functions'); // apps/backend/functions

// 環境別に .env / .env.test を読む
dotenv.config({
  path: path.join(functionsRoot, isTest ? '.env.test' : '.env'),
});

const getProdAppOptions = (): admin.AppOptions => {
  // Cloud Functions / Cloud Run では FIREBASE_CONFIG が入る
  const firebaseConfigRaw = process.env.FIREBASE_CONFIG;
  if (!firebaseConfigRaw) return {};

  try {
    const firebaseConfig = JSON.parse(firebaseConfigRaw) as {
      projectId?: string;
      storageBucket?: string;
    };
    return {
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
    };
  } catch (e) {
    console.warn('Failed to parse FIREBASE_CONFIG:', e);
    return {};
  }
};

export let app: admin.app.App | null = null;
export let firestore: FirebaseFirestore.Firestore | null = null;
export let storage: admin.storage.Storage | null = null;
export let bucket: Bucket | null = null;
export let auth: admin.auth.Auth | null = null;

dotenv.config({
  path: path.join(functionsRoot, isTest ? '.env.test' : '.env'),
});

// エミュレータ使用フラグを判定
const useEmulators =
  process.env.USE_FIREBASE_EMULATORS === 'true' ||
  process.env.FUNCTIONS_EMULATOR === 'true' ||
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  !!process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
  !!process.env.STORAGE_EMULATOR_HOST;

const isProd = !isTest && !useEmulators;

export const initializeApp = () => {
  if (app) return;

  const hasDefaultApp = admin.apps.some((a) => a && a.name === '[DEFAULT]');
  if (!hasDefaultApp) {
    let appOptions: admin.AppOptions = {};

    // --- ローカル/テスト用: service_accounts.json or APPLICATION_CREDENTIALS を使う ---
    let certPath: string | null = null;
    if (isProd) {
      console.log('Using default application credentials in production');

      const appOptionsFromEnv: admin.AppOptions = {};
      const projectId =
        process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
      if (projectId) {
        appOptionsFromEnv.projectId = projectId;
        appOptionsFromEnv.storageBucket = `${projectId}.firebasestorage.app`;
      }

      const appOptionsFromFirebaseConfig = getProdAppOptions();

      appOptions = {
        ...appOptions,
        ...appOptionsFromEnv,
        ...appOptionsFromFirebaseConfig,
      };
    } else {
      const credEnv = process.env.APPLICATION_CREDENTIALS;

      if (credEnv) {
        certPath = path.isAbsolute(credEnv)
          ? credEnv
          : path.join(backendRoot, credEnv);
      } else if (isTest) {
        const candidate = path.join(
          backendRoot,
          'credentials',
          'service_accounts.json',
        );
        if (fs.existsSync(candidate)) certPath = candidate;
      }

      if (certPath) {
        console.log('Using service account (local/emulator):', certPath);
        appOptions.credential = admin.credential.cert(certPath);
      }
    }

    // --- エミュレータ用の projectId / バケット設定 ---
    if (useEmulators) {
      const projectId =
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT ||
        'demo-test-manager';

      process.env.GCLOUD_PROJECT = projectId;
      process.env.GOOGLE_CLOUD_PROJECT = projectId;

      appOptions = {
        ...appOptions,
        projectId,
        storageBucket: `${projectId}.appspot.com`,
      };

      process.env.FIREBASE_STORAGE_EMULATOR_HOST =
        process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
        process.env.STORAGE_EMULATOR_HOST ||
        '127.0.0.1:9199';
      process.env.FIRESTORE_EMULATOR_HOST =
        process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
      process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST =
        process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
    }

    // --- 本番: デフォルト認証 + プロジェクトIDとバケット名だけ明示 ---
    if (isProd) {
      console.log('Using default application credentials in production');

      const projectId =
        process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

      if (projectId) {
        appOptions = {
          ...appOptions,
          projectId,
          storageBucket: `${projectId}.firebasestorage.app`,
        };
      }
    }

    admin.initializeApp(appOptions);
  }

  app = admin.app();
  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);
  bucket = storage.bucket();
};

// setGlobalOptions({ region: 'asia-northeast1' });

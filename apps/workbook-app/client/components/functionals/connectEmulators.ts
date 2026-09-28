import Constants from 'expo-constants';
import {getApp} from '@react-native-firebase/app';
import {getAuth, connectAuthEmulator} from '@react-native-firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
} from '@react-native-firebase/firestore';
import {
  getDatabase,
  connectDatabaseEmulator,
} from '@react-native-firebase/database';
import {
  getFunctions,
  connectFunctionsEmulator,
} from '@react-native-firebase/functions';
import {
  getStorage,
  connectStorageEmulator,
} from '@react-native-firebase/storage';
import {
  getAnalytics,
  setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

// Emulator の port 定義(apps/backend/firebase.json と一致させる)
const EMULATOR_PORTS = {
  auth: 9599,
  firestore: 8581,
  database: 9500,
  functions: 5501,
  storage: 9699,
} as const;

// 二重接続を防ぐためのモジュールスコープフラグ。
let connected = false;

/**
 * APP_ENV=local のときだけ Firebase Emulator に接続する。
 * dev/staging/prod では何もしない(従来の Firebase project 接続を維持)。
 *
 * RN Firebase の default インスタンスは app 単位の singleton なので、
 * ここで取得・接続切替したインスタンスは各 controller が後から
 * getFirestore(app) 等で取得する同一インスタンスに反映される。
 */
export const connectFirebaseEmulators = (): void => {
  const {extra} = Constants.expoConfig ?? {};
  if (!extra?.USE_FIREBASE_EMULATOR) {
    return;
  }

  if (connected) {
    return;
  }

  connected = true;

  const host = (extra.FIREBASE_EMULATOR_HOST as string) ?? '10.0.2.2';
  const app = getApp();

  // Functions は asia-northeast1 region を維持したまま接続する。
  const functions = getFunctions(app, 'asia-northeast1');

  connectAuthEmulator(getAuth(app), `http://${host}:${EMULATOR_PORTS.auth}`);
  connectFirestoreEmulator(getFirestore(app), host, EMULATOR_PORTS.firestore);
  connectDatabaseEmulator(getDatabase(app), host, EMULATOR_PORTS.database);
  connectFunctionsEmulator(functions, host, EMULATOR_PORTS.functions);
  connectStorageEmulator(getStorage(app), host, EMULATOR_PORTS.storage);

  // local では Analytics / Crashlytics を無効化して no-op 扱いにする。
  setAnalyticsCollectionEnabled(getAnalytics(app), false).catch(
    (error: unknown) => {
      console.error('disable analytics failed', error);
    },
  );
  setCrashlyticsCollectionEnabled(getCrashlytics(), false).catch(
    (error: unknown) => {
      console.error('disable crashlytics failed', error);
    },
  );

  console.info(`Firebase Emulator に接続しました host=${host}`);
};

import type {Bucket} from '@google-cloud/storage';
import * as admin from 'firebase-admin';
import {getStorage} from 'firebase-admin/storage';
import {defineSecret} from 'firebase-functions/params';
export const PROJECT_CONFIG_SECRET = defineSecret('PROJECT_CONFIG');
export const MANAGER_SHEET_ID_SECRET = defineSecret('MANAGER_SHEET_ID');
export const ADMIN_EMAILS_SECRET = defineSecret('ADMIN_EMAILS');

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore;
let bucket: Bucket;
let managerSheetId: string;
let firebaseEnv: 'dev' | 'prod';

const initializeApp = () => {
  try {
    if (!app) {
      const firebaseConfig = JSON.parse(
        PROJECT_CONFIG_SECRET.value(),
      ) as admin.AppOptions;
      app = admin.initializeApp(firebaseConfig);
      firebaseEnv = firebaseConfig.projectId?.startsWith('dev-')
        ? 'dev'
        : 'prod';
    }
    db = app.firestore();
    bucket = getStorage(app).bucket();
  } catch (e: unknown) {
    console.error("initializeApp：処理失敗", e);
    throw new Error(`Failed to initialize Firebase app `);
  }
};

export const initializeManagerSheetId = () => {
  managerSheetId = MANAGER_SHEET_ID_SECRET.value();
};
/*functions.runWith({ secrets: [MANAGER_SHEET_ID_SECRET] }).https.onRequest((req, res) => {
    managerSheetId = MANAGER_SHEET_ID_SECRET.value();
    res.send(MANAGER_SHEET_ID_SECRET.value());
});
*/

export const getApp = () => app;
export const getDb = () => db;
export const getBucket = () => bucket;
export const getManagerSheetId = () => managerSheetId;
export const getFirebaseEnv = () => firebaseEnv;

export default initializeApp;

// const firebaseConfig = JSON.parse(PROJECT_CONFIG_JSON) as admin.AppOptions;// functions.config().project_config.project_config;
// const app = admin.initializeApp(firebaseConfig);

// export const firebaseEnv = firebaseConfig.projectId?.startsWith('dev-') ? 'dev' : 'prod';
// export const db = app.firestore();
// export const firestore = app.firestore;
// export const bucket = getStorage().bucket();
// export default app;

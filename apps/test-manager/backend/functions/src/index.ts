/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { randomUUID } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import {
  getAllowedAdminEmails,
  setCustomClaimsHandler,
  setQaaReadClaimsHandler,
  specialAdminEmailsSecret,
} from './auth';
import {
  _getSignedUrl,
  addDimensionsForAllImagesInGrade,
  //  registerAllInPrefix,
  registerSingleImage,
} from './storage';

setGlobalOptions({ region: 'asia-northeast1' });

export const setCustomClaims = onCall(
  { secrets: [specialAdminEmailsSecret] },
  setCustomClaimsHandler,
);

export const setQaaReadClaims = onCall(
  { secrets: [specialAdminEmailsSecret] },
  setQaaReadClaimsHandler,
);

/**
 * Storage にファイルが追加されたときのトリガー (functions v2)
 * 新規アップロード or オブジェクト更新時に該当ファイルを Firestore に登録する
 */

export const onStorageFinalize = onObjectFinalized(async (event) => {
  console.log('onStorageFinalize event:', event);
  // v2 の event.data にストレージオブジェクト情報が入る
  const object = (event.data ?? {}) as { name?: string };
  if (!object?.name) return;
  await registerSingleImage(object.name);
});

/**
 * Storageの指定ファイルの署名付きURLを取得する関数 (onCall)
 */
export const getSignedUrl = onCall<{ objectPath: string; expiresSec?: number }>(
  { region: 'asia-northeast1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です');

    const { objectPath, expiresSec } = req.data;
    if (!objectPath) {
      throw new HttpsError('invalid-argument', 'objectPath が必要です');
    }
    const { url } = await _getSignedUrl(objectPath, expiresSec);
    return { url };
  },
);

/**
 * original/{gradeId}/ 配下の全PNGに width/height を付与する（onCall）
 * Emulator: 認可を緩和（誰でも実行可能）
 * Prod/Stg: SPECIAL_ADMIN_EMAILS に含まれるメールのみ実行可能
 */
export const addDimensionsForGrade = onCall<{
  gradeId: 'firstGrade' | 'secondGrade';
  persistTo?: 'firestore' | 'metadata' | 'both';
}>(
  { region: 'asia-northeast1', secrets: [specialAdminEmailsSecret] },
  async (req) => {
    const isEmu = process.env.FUNCTIONS_EMULATOR === 'true';

    // 本番/ステージングのみメールベースのAdmin認可
    if (!isEmu) {
      const admins = getAllowedAdminEmails();
      const email = req.auth?.token?.email;
      if (!email) {
        throw new HttpsError('unauthenticated', 'ログインが必要です');
      }
      if (!admins.includes(email)) {
        throw new HttpsError('permission-denied', '管理者のみ実行可能です');
      }
    }

    const gradeId = req.data?.gradeId;
    const persistTo = (req.data?.persistTo ?? 'firestore') as
      | 'firestore'
      | 'metadata'
      | 'both';

    if (gradeId !== 'firstGrade' && gradeId !== 'secondGrade') {
      throw new HttpsError(
        'invalid-argument',
        "gradeId は 'firstGrade' | 'secondGrade' が必要です",
      );
    }
    if (!['firestore', 'metadata', 'both'].includes(persistTo)) {
      throw new HttpsError(
        'invalid-argument',
        "persistTo は 'firestore' | 'metadata' | 'both' が必要です",
      );
    }

    await addDimensionsForAllImagesInGrade(gradeId, persistTo);
    return { ok: true };
  },
);

/**
 * 問題データへの uuid 補完 trigger（保険用）。
 * 書き込み後の問題データに uuid が存在しない場合のみ UUIDv4 を付与する。
 * 既に uuid が存在する文書は更新しない（無限ループ防止）。
 * 運用期間はおおむね導入後 1 か月を想定し、その後撤去する。
 */
const assignUuidIfMissing = async (
  after: FirebaseFirestore.DocumentSnapshot | undefined,
): Promise<void> => {
  if (!after?.exists) return;
  const data = after.data();
  if (!data) return;
  // uuid が既に存在する場合はスキップ（再発火ループ防止）
  if (typeof data.uuid === 'string' && data.uuid.length > 0) return;

  await after.ref.set({ uuid: randomUUID() }, { merge: true });
};

export const backfillUuidFirstGrade = onDocumentWritten(
  'firstGrade/{docId}',
  async (event) => {
    await assignUuidIfMissing(event.data?.after);
  },
);

export const backfillUuidSecondGrade = onDocumentWritten(
  'secondGrade/{docId}',
  async (event) => {
    await assignUuidIfMissing(event.data?.after);
  },
);

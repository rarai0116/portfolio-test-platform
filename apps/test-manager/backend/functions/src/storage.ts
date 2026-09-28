import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { FileMetadata } from '@google-cloud/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { bucket, firestore, initializeApp, storage } from './admin';

// import { onObjectFinalized } from "firebase-functions/v2/storage";

type ImageDoc = {
  key: string;
  createdAt?: FirebaseFirestore.Timestamp | null;
  updatedAt?: FirebaseFirestore.Timestamp | null;
  title: string;
  grade: '1級' | '2級';
  subject: string;
  bigCategoryTag?: string;
  smallCategoryTag?: string;
  usedIds: string[];
  tag: string[];
  md5Hash: string;
  generation: number;
  contentType: string;
  size: number;
  objectPath: string;
  width?: number;
  height?: number;
};

type ImageDimensions = { width: number; height: number };

type GradeCollection = 'firstGrade' | 'secondGrade';

type ImageRegistrationTarget = {
  gradeCollection: GradeCollection;
  key: string;
  collectionPath: `storageList/${GradeCollection}/images`;
  shardSuffix: string;
  indexDocId: string;
};

const _hasOwnProperty = Object.prototype.hasOwnProperty;

function hashDocId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toShardSuffix(docId: string, shardCount: number): string {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return _hasOwnProperty.call(record, key);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function areTimestampsEqual(
  left: FirebaseFirestore.Timestamp | null | undefined,
  right: FirebaseFirestore.Timestamp | null | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.seconds === right.seconds && left.nanoseconds === right.nanoseconds
  );
}

function buildMergedImageDoc(
  currentData: Record<string, unknown>,
  storageDoc: ImageDoc,
): ImageDoc & { deleted: boolean } {
  const createdAt =
    currentData.createdAt instanceof Timestamp
      ? currentData.createdAt
      : storageDoc.createdAt;
  const title = typeof currentData.title === 'string' ? currentData.title : '';
  const subject =
    typeof currentData.subject === 'string' ? currentData.subject : '';
  const bigCategoryTag =
    typeof currentData.bigCategoryTag === 'string'
      ? currentData.bigCategoryTag
      : '';
  const smallCategoryTag =
    typeof currentData.smallCategoryTag === 'string'
      ? currentData.smallCategoryTag
      : '';
  const usedIds = hasOwn(currentData, 'usedIds')
    ? normalizeStringArray(currentData.usedIds)
    : storageDoc.usedIds;
  const tag = hasOwn(currentData, 'tag')
    ? normalizeStringArray(currentData.tag)
    : storageDoc.tag;
  const deleted = currentData.deleted === true;

  return {
    ...storageDoc,
    createdAt,
    title,
    subject,
    bigCategoryTag,
    smallCategoryTag,
    usedIds,
    tag,
    deleted,
  };
}

function hasImageDocChanged(
  currentData: Record<string, unknown>,
  nextData: ImageDoc & { deleted: boolean },
): boolean {
  const currentCreatedAt =
    currentData.createdAt instanceof Timestamp ? currentData.createdAt : null;
  const currentUpdatedAt =
    currentData.updatedAt instanceof Timestamp ? currentData.updatedAt : null;

  return !(
    currentData.key === nextData.key &&
    areTimestampsEqual(currentCreatedAt, nextData.createdAt ?? null) &&
    areTimestampsEqual(currentUpdatedAt, nextData.updatedAt ?? null) &&
    currentData.title === nextData.title &&
    currentData.grade === nextData.grade &&
    currentData.subject === nextData.subject &&
    currentData.bigCategoryTag === nextData.bigCategoryTag &&
    currentData.smallCategoryTag === nextData.smallCategoryTag &&
    areStringArraysEqual(
      normalizeStringArray(currentData.usedIds),
      nextData.usedIds,
    ) &&
    areStringArraysEqual(normalizeStringArray(currentData.tag), nextData.tag) &&
    currentData.md5Hash === nextData.md5Hash &&
    Number(currentData.generation ?? 0) === nextData.generation &&
    currentData.contentType === nextData.contentType &&
    Number(currentData.size ?? 0) === nextData.size &&
    currentData.objectPath === nextData.objectPath &&
    Number(currentData.width ?? 0) === Number(nextData.width ?? 0) &&
    Number(currentData.height ?? 0) === Number(nextData.height ?? 0) &&
    currentData.deleted === nextData.deleted
  );
}

function resolveImageRegistrationTarget(
  filePath: string,
): ImageRegistrationTarget | null {
  const gradeCollection =
    filePath.includes('/original/firstGrade/') ||
    filePath.startsWith('original/firstGrade/')
      ? 'firstGrade'
      : filePath.includes('/original/secondGrade/') ||
          filePath.startsWith('original/secondGrade/')
        ? 'secondGrade'
        : null;

  if (!gradeCollection) {
    return null;
  }

  const key = basename(filePath, '.png');
  const shardSuffix = toShardSuffix(key, 16);
  const indexDocPrefix =
    gradeCollection === 'firstGrade'
      ? 'storageList_firstGrade_images'
      : 'storageList_secondGrade_images';

  return {
    gradeCollection,
    key,
    collectionPath: `storageList/${gradeCollection}/images`,
    shardSuffix,
    indexDocId: `${indexDocPrefix}_${shardSuffix}`,
  };
}

async function upsertImageDocWithCacheIndex(
  target: ImageRegistrationTarget,
  doc: ImageDoc,
): Promise<void> {
  if (!firestore) throw new Error('Firestore is not initialized');

  const docRef = firestore
    .collection('storageList')
    .doc(target.gradeCollection)
    .collection('images')
    .doc(target.key);
  const indexRef = firestore.collection('cacheIndex').doc(target.indexDocId);

  await firestore.runTransaction(async (tx) => {
    const docSnap = await tx.get(docRef);
    const indexSnap = await tx.get(indexRef);
    const currentDocData = docSnap.data();
    const currentDoc =
      docSnap.exists && isRecord(currentDocData) ? currentDocData : {};
    const indexData = indexSnap.exists ? indexSnap.data() : {};
    const currentItems = isRecord(indexData?.items)
      ? { ...indexData.items }
      : {};
    const nextDoc = buildMergedImageDoc(currentDoc, doc);
    const itemUpdatedAt = nextDoc.updatedAt ?? Timestamp.now();
    const currentItemValue = currentItems[target.key];
    const currentItem = isRecord(currentItemValue) ? currentItemValue : {};
    const cacheIndexNeedsUpdate =
      currentItem.deleted !== nextDoc.deleted ||
      currentItem.updatedAt === undefined ||
      indexData?.collectionPath !== target.collectionPath ||
      indexData?.shard !== target.shardSuffix;
    const docNeedsUpdate = hasImageDocChanged(currentDoc, nextDoc);

    if (!docNeedsUpdate && !cacheIndexNeedsUpdate) {
      return;
    }

    tx.set(docRef, nextDoc, { merge: true });

    currentItems[target.key] = {
      updatedAt: itemUpdatedAt,
      deleted: nextDoc.deleted,
    };

    tx.set(
      indexRef,
      {
        collectionPath: target.collectionPath,
        shard: target.shardSuffix,
        updatedAt: itemUpdatedAt,
        items: currentItems,
      },
      { merge: true },
    );
  });
}

async function getPngDimensions(
  objectPath: string,
): Promise<ImageDimensions | null> {
  initializeApp();
  if (!storage) throw new Error('Storage is not initialized');
  const file = storage.bucket().file(objectPath);

  // PNGの先頭32バイト程度を読めばIHDRに到達できます
  // オフセット:
  //   0..7   : PNGシグネチャ
  //   8..11  : 最初のチャンク長 (IHDRは13)
  //   12..15 : チャンクタイプ ('IHDR')
  //   16..19 : 幅 (UInt32BE)
  //   20..23 : 高さ (UInt32BE)
  const stream = file.createReadStream({ start: 0, end: 32 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (d) => chunks.push(d));
    stream.on('error', (e) => reject(e));
    stream.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 24) {
        resolve(null);
        return;
      }
      // PNGシグネチャ確認
      const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (!buf.slice(0, 8).equals(sig)) {
        resolve(null);
        return;
      }
      const chunkType = buf.slice(12, 16).toString('ascii');
      if (chunkType !== 'IHDR') {
        resolve(null);
        return;
      }
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      resolve({ width, height });
    });
  });
}

/**
 * 指定されたストレージファイルパスを元に Firestore ドキュメントを作成 / 更新する関数
 * 保存場所: storageList/{firstGrade|secondGrade}/images/{key}
 */
export async function registerSingleImage(filePath: string): Promise<void> {
  initializeApp();
  if (!filePath) return;
  if (!firestore || !bucket)
    throw new Error('Firestore or Bucket is not initialized');

  // png のみ処理
  if (extname(filePath).toLowerCase() !== '.png') return;

  const target = resolveImageRegistrationTarget(filePath);
  if (!target) {
    // 対象外のパスなら何もしない
    return;
  }

  // メタデータを取得（存在しない場合は最低限の情報で作成）
  const file = bucket.file(filePath);
  let meta: FileMetadata | undefined;
  try {
    const [m] = await file.getMetadata();
    meta = m;
  } catch (err: unknown) {
    console.warn('failed to get metadata for', filePath, err);
    // メタ取得失敗でも続行して最小ドキュメントを作る
    meta = undefined;
  }

  const createdAt = meta?.timeCreated
    ? Timestamp.fromDate(new Date(meta.timeCreated))
    : null;
  const updatedAt = meta?.updated
    ? Timestamp.fromDate(new Date(meta.updated))
    : null;

  // ★ 寸法取得（失敗したら Storage から削除してエラー）
  let dim: ImageDimensions | null = null;
  try {
    dim = await getPngDimensions(filePath);
  } catch (e) {
    console.warn('getPngDimensions failed', { filePath, error: String(e) });
    dim = null;
  }

  if (!dim) {
    // 寸法が取れない PNG は無効とみなし、ストレージからも削除する
    try {
      await file.delete();
    } catch (e) {
      console.error('failed to delete invalid png file', {
        filePath,
        error: String(e),
      });
    }
    throw new Error(
      `Failed to get PNG dimensions for ${filePath}; document not created.`,
    );
  }

  const width = dim.width;
  const height = dim.height;

  const doc: ImageDoc = {
    key: target.key,
    createdAt,
    updatedAt,
    title: '',
    grade: target.gradeCollection === 'firstGrade' ? '1級' : '2級',
    subject: '',
    bigCategoryTag: '',
    smallCategoryTag: '',
    usedIds: [],
    tag: ['src:問題集'],
    md5Hash: meta?.md5Hash ?? '',
    generation: Number(meta?.generation ?? '0'),
    contentType: meta?.contentType ?? 'image/png',
    size: Number(meta?.size ?? 0), // bytes
    objectPath: filePath,
    width,
    height,
  };

  await upsertImageDocWithCacheIndex(target, doc);
}

/**
 * 指定プレフィックス内の画像を列挙して registerSingleImage を逐次実行する関数
 * prefix 例: "original/firstGrade/" または "original/secondGrade/"
 */
/*
export async function registerAllInPrefix(prefix: string): Promise<void> {
  initializeApp();
  if (!firestore || !bucket || !storage)
    throw new Error('Firestore or Bucket is not initialized');
  if (!prefix) throw new Error('Prefix is required');
  const [files] = await bucket.getFiles({ prefix });

  for (const file of files) {
    // フォルダ的エントリをスキップするためファイル名をチェック
    if (!file.name) continue;
    if (extname(file.name).toLowerCase() !== '.png') continue;

    // 逐次登録（必要なら並列化も検討）
    try {
      await registerSingleImage(file.name);
    } catch (err) {
      console.error('failed to register', file.name, err);
    }
  }
}
*/

export const _getSignedUrl = async (
  objectPath: string,
  expiresSec?: number,
) => {
  initializeApp();
  if (!storage) throw new Error('Firestore or Bucket is not initialized');
  if (!objectPath)
    throw new HttpsError('invalid-argument', 'objectPath が必要です');

  // 本番（GCF/Cloud Run）では emulator を無効化
  //  const runningOnGCF = !!process.env.K_SERVICE || !!process.env.FUNCTION_TARGET;
  const localEmuSignal =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    !!process.env.STORAGE_EMULATOR_HOST;
  console.log('[getSignedUrl] environment', {
    //    runningOnGCF,
    localEmuSignal,
    FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
  });
  const isEmu = localEmuSignal;
  console.log('[getSignedUrl] objectPath request', { objectPath, isEmu });

  const file = storage.bucket().file(objectPath);
  const bucketName = storage.bucket().name;

  const [exists] = await file.exists().catch((e) => {
    console.error('[getSignedUrl] exists() failed', {
      objectPath,
      bucketName,
      isEmu,
      env: {
        K_SERVICE: process.env.K_SERVICE,
        FUNCTION_TARGET: process.env.FUNCTION_TARGET,
        FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
        FIREBASE_STORAGE_EMULATOR_HOST:
          process.env.FIREBASE_STORAGE_EMULATOR_HOST,
        STORAGE_EMULATOR_HOST: process.env.STORAGE_EMULATOR_HOST,
      },
      error: String(e),
    });
    throw new HttpsError('internal', 'storage exists チェックに失敗しました');
  });
  if (!exists) {
    console.warn('[getSignedUrl] object not found', {
      objectPath,
      bucketName,
      isEmu,
    });
    throw new HttpsError(
      'not-found',
      `オブジェクトが見つかりません: gs://${bucketName}/${objectPath}`,
    );
  }

  if (isEmu) {
    // エミュレータ: downloadTokens を用いた v0 API の URL を返す
    let md: Record<string, string | undefined> = {};
    try {
      const [meta] = await file.getMetadata();
      md = (meta?.metadata ?? {}) as Record<string, string | undefined>;
    } catch (e: unknown) {
      // メタが取れなくても token 付与を試みる
      md = {};
      // ここで token を付与する処理を追加
      console.error('[getSignedUrl] getMetadata failed', {
        objectPath,
        bucketName,
        error: String(e),
      });
    }

    let tokens = (md.firebaseStorageDownloadTokens ?? '')
      .split(',')
      .filter(Boolean);

    if (tokens.length === 0) {
      const token = randomUUID();
      tokens = [token];
      await file.setMetadata({
        metadata: {
          ...md,
          firebaseStorageDownloadTokens: tokens.join(','),
        },
      });
    }

    const token = tokens[0];
    const host =
      process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
      process.env.STORAGE_EMULATOR_HOST ||
      '127.0.0.1:9199';
    const encoded = encodeURIComponent(objectPath);
    const url = `http://${host}/v0/b/${bucketName}/o/${encoded}?alt=media&token=${encodeURIComponent(
      token,
    )}`;

    console.info('[getSignedUrl] emulator URL ready', {
      bucketName,
      objectPath,
      url,
    });
    return { url };
  }

  // 本番/ステージング: 署名URL
  const expiresMs = (expiresSec ?? 300) * 1000;
  try {
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresMs,
    });
    console.info('[getSignedUrl] signed URL ready', { bucketName, objectPath });
    return { url };
  } catch (e) {
    console.error('[getSignedUrl] getSignedUrl failed', {
      bucketName,
      objectPath,
      error: String(e),
    });
    throw new HttpsError('internal', '署名URLの生成に失敗しました');
  }
};

/**
 * original/{gradeId}/ 配下にある全PNG画像の width/height を付与します。
 * デフォルトは Firestore の storageList/{gradeId}/images/{key} に保存します。
 * persistTo を 'metadata' または 'both' にすると、Storage の customMetadata にも書き込みます。
 */
export async function addDimensionsForAllImagesInGrade(
  gradeId: 'firstGrade' | 'secondGrade',
  persistTo: 'firestore' | 'metadata' | 'both' = 'firestore',
): Promise<void> {
  initializeApp();
  if (!firestore) throw new Error('Firestore is not initialized');
  if (!bucket || !storage) throw new Error('Storage/Bucket is not initialized');

  const prefix = `original/${gradeId}/`;
  const [files] = await bucket.getFiles({ prefix });

  for (const f of files) {
    const name = f.name;
    if (!name) continue;
    if (extname(name).toLowerCase() !== '.png') continue;

    // PNG寸法を取得（失敗時はスキップ）
    let dim: ImageDimensions | null = null;
    try {
      dim = await getPngDimensions(name);
    } catch (e) {
      console.warn('[addDimensions] getPngDimensions failed', {
        name,
        error: String(e),
      });
      dim = null;
    }
    if (!dim) continue;

    // Storage customMetadata へ付与
    if (persistTo === 'metadata' || persistTo === 'both') {
      try {
        const obj = bucket.file(name);
        let currentMd: Record<string, string | undefined> = {};
        try {
          const [meta] = await obj.getMetadata();
          currentMd = (meta?.metadata ?? {}) as Record<
            string,
            string | undefined
          >;
        } catch {
          currentMd = {};
        }
        await obj.setMetadata({
          metadata: {
            ...currentMd,
            width: String(dim.width),
            height: String(dim.height),
          },
        });
      } catch (e) {
        console.error('[addDimensions] setMetadata failed', {
          name,
          error: String(e),
        });
      }
    }

    // Firestore へ付与（storageList/{gradeId}/images/{key}）
    if (persistTo === 'firestore' || persistTo === 'both') {
      try {
        const key = basename(name, '.png');
        const docRef = firestore
          .collection('storageList')
          .doc(gradeId)
          .collection('images')
          .doc(key);

        await docRef.set(
          {
            width: dim.width,
            height: dim.height,
          },
          { merge: true },
        );
      } catch (e) {
        console.error('[addDimensions] firestore set failed', {
          name,
          error: String(e),
        });
      }
    }
  }
}

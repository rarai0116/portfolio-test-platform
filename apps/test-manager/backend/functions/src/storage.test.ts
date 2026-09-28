import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bucket, firestore, initializeApp } from './admin';
import { registerSingleImage } from './storage';

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

function createTestPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);

  // PNG シグネチャ
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

  // IHDR チャンク長 (13バイト) — 実際には検証していないが一応
  buf.writeUInt32BE(13, 8);

  // チャンクタイプ 'IHDR'
  buf.write('IHDR', 12, 'ascii');

  // 幅・高さ（UInt32BE）
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);

  // 残りは 0 埋めで良い
  return buf;
}

const testBucketPath = 'original/firstGrade/';
const testFilePath = `${testBucketPath}test-image.png`;
const testIndexDocId = `storageList_firstGrade_images_${toShardSuffix(
  'test-image',
  16,
)}`;

describe('storage.ts', () => {
  beforeEach(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    initializeApp();

    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    // ★ 幅 100, 高さ 200 の PNG ヘッダ相当データを書き込む
    const pngBuffer = createTestPng(100, 200);

    // テスト用のファイルをEmulatorにアップロード
    const file = bucket.file(testFilePath);
    await file.save(pngBuffer, {
      resumable: false,
      metadata: { contentType: 'image/png' },
    });
  });

  afterEach(async () => {
    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    // テスト用のFirestoreドキュメントとStorageファイルを削除
    const docRef = firestore
      .collection('storageList')
      .doc('firstGrade')
      .collection('images')
      .doc('test-image');
    await docRef.delete().catch(() => {});

    const indexRef = firestore.collection('cacheIndex').doc(testIndexDocId);
    await indexRef.delete().catch(() => {});

    const file = bucket.file(testFilePath);
    await file.delete().catch(() => {});
  });

  it('registerSingleImage は有効な画像から Firestore と cacheIndex を作成する', async () => {
    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    await registerSingleImage(testFilePath);

    const docRef = firestore
      .collection('storageList')
      .doc('firstGrade')
      .collection('images')
      .doc('test-image');
    const doc = await docRef.get();

    expect(doc.exists).toBe(true);
    const data = doc.data();
    expect(data).toBeTruthy();
    if (data) {
      expect(data.key).toBe('test-image');
      expect(data.grade).toBe('1級');
      expect(data.title).toBe('');
      expect(data.tag).toContain('src:問題集');
      expect(data.width).toBe(100);
      expect(data.height).toBe(200);
    }

    const indexDoc = await firestore
      .collection('cacheIndex')
      .doc(testIndexDocId)
      .get();
    expect(indexDoc.exists).toBe(true);
    expect(indexDoc.data()).toMatchObject({
      collectionPath: 'storageList/firstGrade/images',
      shard: toShardSuffix('test-image', 16),
      items: {
        'test-image': {
          deleted: false,
        },
      },
    });
  });
  /*
  it('registerAllInPrefix は指定 prefix 配下の画像をまとめて登録する', async () => {
    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    await registerAllInPrefix(testBucketPath);

    const docRef = firestore
      .collection('storageList')
      .doc('firstGrade')
      .collection('images')
      .doc('test-image');
    const doc = await docRef.get();

    expect(doc.exists).toBe(true);
    const data = doc.data();
    expect(data).toBeTruthy();
    if (data) {
      expect(data.key).toBe('test-image');
      expect(data.grade).toBe('1級');
      expect(data.title).toBe('');
      expect(data.tag).toContain('src:問題集');
      expect(data.width).toBe(100);
      expect(data.height).toBe(200);
    }

    const indexDoc = await firestore
      .collection('cacheIndex')
      .doc(testIndexDocId)
      .get();
    expect(indexDoc.exists).toBe(true);
    expect(indexDoc.data()).toMatchObject({
      collectionPath: 'storageList/firstGrade/images',
      items: {
        'test-image': {
          deleted: false,
        },
      },
    });
  });
*/
  it('registerSingleImage は既存の画像メタを保持する', async () => {
    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    const docRef = firestore
      .collection('storageList')
      .doc('firstGrade')
      .collection('images')
      .doc('test-image');

    await docRef.set({
      title: '既存タイトル',
      subject: '学科Ⅰ',
      bigCategoryTag: '大分類A',
      smallCategoryTag: '小分類A',
      usedIds: ['0_100'],
      tag: ['src:問題集', 'manual'],
    });

    await registerSingleImage(testFilePath);

    const doc = await docRef.get();
    expect(doc.data()).toMatchObject({
      title: '既存タイトル',
      subject: '学科Ⅰ',
      bigCategoryTag: '大分類A',
      smallCategoryTag: '小分類A',
      usedIds: ['0_100'],
      tag: ['src:問題集', 'manual'],
      width: 100,
      height: 200,
    });
  });

  it('registerSingleImage は deleted 状態を cacheIndex と揃えて保持する', async () => {
    if (!firestore || !bucket)
      throw new Error('Firestore or Bucket is not initialized');

    const docRef = firestore
      .collection('storageList')
      .doc('firstGrade')
      .collection('images')
      .doc('test-image');

    await docRef.set({
      deleted: true,
    });

    await registerSingleImage(testFilePath);

    const doc = await docRef.get();
    expect(doc.data()).toMatchObject({
      deleted: true,
    });

    const indexDoc = await firestore
      .collection('cacheIndex')
      .doc(testIndexDocId)
      .get();
    expect(indexDoc.data()).toMatchObject({
      items: {
        'test-image': {
          deleted: true,
        },
      },
    });
  });
});

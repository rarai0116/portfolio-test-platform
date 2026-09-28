// apps/client/src/app/main/ipc/firestore/cacheManager.test.ts

import type {
  CachedDoc,
  FirestoreIndexItemRow,
  FirestoreStoredDocRow,
  FirestoreSyncStateRow,
} from '@shared/types/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirestoreCacheManager } from './cacheManager';

const hashDocId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const toShardSuffix = (docId: string, shardCount: number): string => {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
};

const makeDoc = (
  collectionPath: string,
  docId: string,
  seconds: number,
  data: Record<string, unknown> = {},
): CachedDoc => ({
  key: docId,
  path: `${collectionPath}/${docId}`,
  data,
  updateTime: {
    seconds,
    nanos: 0,
  },
});

const makeIndexSnapshot = (
  collectionPath: string,
  docId: string,
  seconds: number,
  deleted = false,
): CachedDoc => {
  const shard = toShardSuffix(docId, 16);

  return {
    key: `${collectionPath}_${shard}`,
    path: `cacheIndex/${collectionPath}_${shard}`,
    data: {
      collectionPath,
      shard,
      items: {
        [docId]: {
          updatedAt: {
            seconds,
            nanos: 0,
          },
          deleted,
        },
      },
    },
    updateTime: {
      seconds,
      nanos: 0,
    },
  };
};

const makeSyncState = (
  collectionPath: string,
  overrides: Partial<FirestoreSyncStateRow> = {},
): FirestoreSyncStateRow => ({
  collection_path: collectionPath,
  cache_ready: 1,
  last_full_sync_ms: null,
  last_delta_sync_ms: null,
  last_seen_updated_seconds: null,
  last_seen_updated_nanos: null,
  last_seen_doc_id: null,
  auto_rebuild_last_reason: null,
  auto_rebuild_same_reason_failures: 0,
  auto_rebuild_total_failures: 0,
  auto_rebuild_last_attempt_ms: null,
  auto_rebuild_blocked: 0,
  auto_rebuild_blocked_reason: null,
  last_rebuild_succeeded_ms: null,
  schema_version: 1,
  ...overrides,
});

const flushTasks = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

class FakeCacheDao {
  private storedDocs = new Map<string, FirestoreStoredDocRow>();
  private syncStates = new Map<string, FirestoreSyncStateRow>();
  private indexItems = new Map<string, FirestoreIndexItemRow[]>();

  transactionCalls: Array<{
    docMutations: Array<
      | {
          kind: 'upsert';
          row: Omit<FirestoreStoredDocRow, 'cached_at_ms'> & {
            cached_at_ms?: number;
          };
        }
      | {
          kind: 'delete';
          path: string;
        }
    >;
    indexShardReplacements: Array<{
      shardPath: string;
      rows: FirestoreIndexItemRow[];
    }>;
    syncState: FirestoreSyncStateRow;
  }> = [];

  clearTransactionCalls() {
    this.transactionCalls = [];
  }

  async applyFirestoreLocalSyncTransaction(input: {
    docMutations: Array<
      | {
          kind: 'upsert';
          row: Omit<FirestoreStoredDocRow, 'cached_at_ms'> & {
            cached_at_ms?: number;
          };
        }
      | {
          kind: 'delete';
          path: string;
        }
    >;
    indexShardReplacements: Array<{
      shardPath: string;
      rows: FirestoreIndexItemRow[];
    }>;
    syncState: FirestoreSyncStateRow;
  }): Promise<boolean> {
    this.transactionCalls.push(input);

    for (const mutation of input.docMutations) {
      if (mutation.kind === 'delete') {
        this.storedDocs.delete(mutation.path);
        continue;
      }

      this.storedDocs.set(mutation.row.path, {
        ...mutation.row,
        cached_at_ms: mutation.row.cached_at_ms ?? Date.now(),
      });
    }

    for (const replacement of input.indexShardReplacements) {
      this.indexItems.set(replacement.shardPath, [...replacement.rows]);
    }

    this.syncStates.set(input.syncState.collection_path, input.syncState);
    return true;
  }

  async getFirestoreSyncStateByCollection(
    collectionPath: string,
  ): Promise<FirestoreSyncStateRow | null> {
    return this.syncStates.get(collectionPath) ?? null;
  }

  async upsertFirestoreSyncState(row: FirestoreSyncStateRow): Promise<boolean> {
    this.syncStates.set(row.collection_path, row);
    return true;
  }

  async listFirestoreStoredDocsByCollection(
    collectionPath: string,
  ): Promise<FirestoreStoredDocRow[]> {
    return [...this.storedDocs.values()].filter(
      (row) => row.collection_path === collectionPath,
    );
  }

  async upsertFirestoreStoredDoc(
    row: Omit<FirestoreStoredDocRow, 'cached_at_ms'> & {
      cached_at_ms?: number;
    },
  ): Promise<boolean> {
    this.storedDocs.set(row.path, {
      ...row,
      cached_at_ms: row.cached_at_ms ?? Date.now(),
    });
    return true;
  }

  async deleteFirestoreStoredDoc(path: string): Promise<boolean> {
    this.storedDocs.delete(path);
    return true;
  }

  async getFirestoreStoredDocByPath(
    path: string,
  ): Promise<FirestoreStoredDocRow | null> {
    return this.storedDocs.get(path) ?? null;
  }

  async replaceFirestoreIndexItemsByShard(
    shardPath: string,
    rows: FirestoreIndexItemRow[],
  ): Promise<boolean> {
    this.indexItems.set(shardPath, [...rows]);
    return true;
  }

  async listFirestoreIndexItemsByShard(
    shardPath: string,
  ): Promise<FirestoreIndexItemRow[]> {
    return [...(this.indexItems.get(shardPath) ?? [])];
  }
}

class FakeFirestoreClient {
  collectionDocs = new Map<string, CachedDoc[]>();
  docMap = new Map<string, CachedDoc | null>();
  private listeners: Array<{
    spec: { collectionPath: string; where?: Array<[string, string, string]> };
    onChange: (
      events: Array<{
        type: 'added' | 'modified' | 'removed';
        doc: CachedDoc;
      }>,
    ) => void;
  }> = [];

  listenQuery = vi.fn(
    (
      spec: { collectionPath: string; where?: Array<[string, string, string]> },
      onChange: (
        events: Array<{
          type: 'added' | 'modified' | 'removed';
          doc: CachedDoc;
        }>,
      ) => void,
    ) => {
      this.listeners.push({ spec, onChange });
      return () => {
        this.listeners = this.listeners.filter(
          (item) => item.onChange !== onChange,
        );
      };
    },
  );

  getOnce = vi.fn(async (spec: { collectionPath: string }) => {
    return this.collectionDocs.get(spec.collectionPath) ?? [];
  });

  getDoc = vi.fn(async (path: string) => {
    return this.docMap.get(path) ?? null;
  });

  applyWrite = vi.fn();

  ensureReadAccess = vi.fn(async () => {});

  /** path -> 削除済みを含むサーバー上の現在値 */
  serverDocs = new Map<string, CachedDoc>();
  serverDeletedPaths = new Set<string>();

  getDocFromServerIncludingDeleted = vi.fn(async (path: string) => {
    const doc = this.serverDocs.get(path);
    if (!doc) {
      return { kind: 'not-found' as const };
    }
    return this.serverDeletedPaths.has(path)
      ? ({ kind: 'deleted', doc } as const)
      : ({ kind: 'active', doc } as const);
  });

  listenerCount() {
    return this.listeners.length;
  }

  emitIndexChange(
    collectionPath: string,
    changes: Array<{
      type: 'added' | 'modified' | 'removed';
      doc: CachedDoc;
    }>,
  ) {
    const listener = this.listeners.find((item) => {
      const where = item.spec.where ?? [];
      return (
        item.spec.collectionPath === 'cacheIndex' &&
        where.some(
          (entry) =>
            entry[0] === 'collectionPath' &&
            entry[1] === '==' &&
            entry[2] === collectionPath,
        )
      );
    });

    if (!listener) {
      throw new Error(`listener not found: ${collectionPath}`);
    }

    listener.onChange(changes);
  }
}

describe('FirestoreCacheManager', () => {
  let cacheDao: FakeCacheDao;
  let client: FakeFirestoreClient;
  let manager: FirestoreCacheManager;

  beforeEach(() => {
    cacheDao = new FakeCacheDao();
    client = new FakeFirestoreClient();

    client.collectionDocs.set('firstGrade', [
      makeDoc('firstGrade', 'doc1', 1, { title: '初期データ1' }),
    ]);
    client.collectionDocs.set('secondGrade', []);

    client.docMap.set(
      'firstGrade/doc1',
      makeDoc('firstGrade', 'doc1', 2, { title: '更新後データ1' }),
    );

    manager = new FirestoreCacheManager(
      cacheDao as unknown as never,
      client as unknown as never,
    );
  });

  it('ローカルキャッシュが無ければ初回 full sync する', async () => {
    await manager.getOnce({
      collectionPath: 'firstGrade',
    });

    const syncState =
      await cacheDao.getFirestoreSyncStateByCollection('firstGrade');

    expect(syncState?.cache_ready).toBe(1);
    expect(client.getOnce).toHaveBeenCalledWith({
      collectionPath: 'firstGrade',
    });
    expect(manager.getMetrics().remote.fullSyncCount).toBeGreaterThanOrEqual(1);
  });

  it('2回目以降の getOnce は local のみを使う', async () => {
    await manager.getOnce({
      collectionPath: 'firstGrade',
    });

    manager.resetMetrics();
    client.getOnce.mockClear();

    const docs = await manager.getOnce({
      collectionPath: 'firstGrade',
    });

    expect(docs).toHaveLength(1);
    expect(client.getOnce).not.toHaveBeenCalled();

    const metrics = manager.getMetrics();
    expect(metrics.local.queryCount).toBe(1);
    expect(metrics.cache.hitCount).toBe(1);
    expect(metrics.remote.fullSyncCount).toBe(0);
  });

  it('changed key が1件なら対象 doc 1件だけ再取得する', async () => {
    await manager.ensureStarted();

    manager.resetMetrics();
    client.getDoc.mockClear();

    client.emitIndexChange('firstGrade', [
      {
        type: 'modified',
        doc: makeIndexSnapshot('firstGrade', 'doc1', 2),
      },
    ]);

    await flushTasks();

    expect(client.getDoc).toHaveBeenCalledTimes(1);
    expect(client.getDoc).toHaveBeenCalledWith('firstGrade/doc1');

    const metrics = manager.getMetrics();
    expect(metrics.remote.indexSnapshotCount).toBe(1);
    expect(metrics.remote.deltaFetchDocCount).toBe(1);
  });

  it('指定docIdだけ cacheIndex を即時同期できる', async () => {
    await manager.ensureStarted();

    cacheDao.clearTransactionCalls();
    client.getDoc.mockClear();

    const shard = toShardSuffix('doc1', 16);
    const shardPath = `cacheIndex/firstGrade_${shard}`;

    client.docMap.set(shardPath, makeIndexSnapshot('firstGrade', 'doc1', 5));
    client.docMap.set(
      'firstGrade/doc1',
      makeDoc('firstGrade', 'doc1', 5, { title: '同期後データ1' }),
    );

    const result = await manager.syncCacheIndexEntries({
      collectionPath: 'firstGrade',
      docIds: ['doc1'],
    });

    expect(result).toEqual({
      collectionPath: 'firstGrade',
      requestedDocCount: 1,
      syncedDocCount: 1,
      touchedShardCount: 1,
    });
    expect(client.getDoc).toHaveBeenCalledWith(shardPath);
    expect(client.getDoc).toHaveBeenCalledWith('firstGrade/doc1');
    expect(cacheDao.transactionCalls).toHaveLength(1);
  });

  it('logical delete の doc は local query から除外される', async () => {
    client.collectionDocs.set('firstGrade', [
      makeDoc('firstGrade', 'doc1', 1, {
        title: '削除済みデータ',
        deleted: true,
      }),
    ]);

    manager = new FirestoreCacheManager(
      cacheDao as unknown as never,
      client as unknown as never,
    );

    await manager.ensureStarted();
    manager.resetMetrics();

    const docs = await manager.getOnce({
      collectionPath: 'firstGrade',
    });

    expect(docs).toHaveLength(0);
    expect(manager.getMetrics().local.queryCount).toBe(1);
  });

  it('ローカルキャッシュがある場合は full sync せず差分比較へ進む', async () => {
    const shard = toShardSuffix('doc1', 16);
    const shardPath = `cacheIndex/firstGrade_${shard}`;

    await cacheDao.upsertFirestoreStoredDoc({
      path: 'firstGrade/doc1',
      collection_path: 'firstGrade',
      doc_id: 'doc1',
      data: { title: '既存データ' },
      updated_seconds: 1,
      updated_nanos: 0,
      deleted: 0,
    });
    await cacheDao.upsertFirestoreSyncState(makeSyncState('firstGrade'));
    await cacheDao.replaceFirestoreIndexItemsByShard(shardPath, [
      {
        shard_path: shardPath,
        collection_path: 'firstGrade',
        doc_id: 'doc1',
        updated_seconds: 1,
        updated_nanos: 0,
        deleted: 0,
      },
    ]);

    client.getOnce.mockClear();
    client.getDoc.mockClear();

    await manager.ensureStarted();

    client.emitIndexChange('firstGrade', [
      {
        type: 'modified',
        doc: makeIndexSnapshot('firstGrade', 'doc1', 2),
      },
    ]);
    await flushTasks();

    expect(client.getOnce).not.toHaveBeenCalledWith({
      collectionPath: 'firstGrade',
    });
    expect(client.getDoc).toHaveBeenCalledWith('firstGrade/doc1');
  });

  it('full sync 中は同一 shard の最後の snapshot だけを再比較に使う', async () => {
    let resolveFirstGrade: ((docs: CachedDoc[]) => void) | undefined;

    client.getOnce.mockImplementation(
      async (spec: { collectionPath: string }) => {
        if (spec.collectionPath === 'firstGrade') {
          return await new Promise<CachedDoc[]>((resolve) => {
            resolveFirstGrade = resolve;
          });
        }
        return [];
      },
    );

    client.docMap.set(
      'firstGrade/doc1',
      makeDoc('firstGrade', 'doc1', 3, { title: '最終版' }),
    );

    const getOncePromise = manager.getOnce({
      collectionPath: 'firstGrade',
    });

    // getOnce(firstGrade) が remote full sync に到達するまで進める
    await flushTasks();

    if (!resolveFirstGrade) {
      throw new Error('resolveFirstGrade is not set');
    }

    client.emitIndexChange('firstGrade', [
      {
        type: 'modified',
        doc: makeIndexSnapshot('firstGrade', 'doc1', 2),
      },
    ]);
    client.emitIndexChange('firstGrade', [
      {
        type: 'modified',
        doc: makeIndexSnapshot('firstGrade', 'doc1', 3),
      },
    ]);

    resolveFirstGrade([makeDoc('firstGrade', 'doc1', 1, { title: '初期版' })]);

    await getOncePromise;
    await flushTasks();

    const storedDoc =
      await cacheDao.getFirestoreStoredDocByPath('firstGrade/doc1');

    expect(client.getDoc).toHaveBeenCalledTimes(1);
    expect(storedDoc?.updated_seconds).toBe(3);
  });

  it('full sync 時に miss と rebuild metrics を更新する', async () => {
    await manager.getOnce({
      collectionPath: 'firstGrade',
    });

    const metrics = manager.getMetrics();

    expect(metrics.remote.fullSyncCount).toBeGreaterThanOrEqual(1);
    expect(metrics.cache.missCount).toBeGreaterThanOrEqual(1);
    expect(metrics.sync.rebuildCount).toBeGreaterThanOrEqual(1);
    expect(metrics.sync.lastReason).toBe('cache-not-ready');
  });

  it('差分反映は firestore_docs と index_items と sync_state を同一 transaction で更新する', async () => {
    await manager.ensureStarted();

    cacheDao.clearTransactionCalls();
    client.getDoc.mockClear();

    client.emitIndexChange('firstGrade', [
      {
        type: 'modified',
        doc: makeIndexSnapshot('firstGrade', 'doc1', 2),
      },
    ]);
    await flushTasks();

    expect(client.getDoc).toHaveBeenCalledTimes(1);
    expect(cacheDao.transactionCalls).toHaveLength(1);
    expect(cacheDao.transactionCalls[0]?.docMutations).toHaveLength(1);
    expect(cacheDao.transactionCalls[0]?.indexShardReplacements).toHaveLength(
      1,
    );
    expect(cacheDao.transactionCalls[0]?.syncState.collection_path).toBe(
      'firstGrade',
    );
  });
  it('asset metrics を記録して取得できる', async () => {
    await manager.ensureStarted();
    manager.resetMetrics();

    manager.recordAssetMetric({ type: 'meta-cache-hit' });
    manager.recordAssetMetric({ type: 'local-file-hit' });
    manager.recordAssetMetric({ type: 'local-file-miss' });
    manager.recordAssetMetric({ type: 'base64-emit' });
    manager.recordAssetMetric({ type: 'download', bytes: 128 });
    manager.recordAssetMetric({
      type: 'meta-invalidation',
      reason: 'replace-requested',
    });

    const metrics = manager.getMetrics();

    expect(metrics.asset.metaCacheHitCount).toBe(1);
    expect(metrics.asset.localFileHitCount).toBe(1);
    expect(metrics.asset.localFileMissCount).toBe(1);
    expect(metrics.asset.base64EmitCount).toBe(1);
    expect(metrics.asset.downloadCount).toBe(1);
    expect(metrics.asset.downloadBytes).toBe(128);
    expect(metrics.asset.metaInvalidationCount).toBe(1);
    expect(metrics.asset.lastInvalidationReason).toBe('replace-requested');
  });
  it('未対応 collectionPath の onCollectionChanged は拒否する', () => {
    expect(() => manager.onCollectionChanged('_meta', vi.fn())).toThrow(
      'Unsupported cacheManager collectionPath',
    );
  });

  describe('認証後の一重監視開始（設計6.4）', () => {
    it('read権限の確認後に index listener を1回だけ登録する', async () => {
      await manager.ensureStarted();
      const listenerCount = client.listenQuery.mock.calls.length;

      await manager.ensureStarted();

      expect(client.ensureReadAccess).toHaveBeenCalledTimes(1);
      expect(client.listenQuery.mock.calls.length).toBe(listenerCount);
      expect(listenerCount).toBeGreaterThan(0);
    });

    it('同時に複数の開始要求が来ても開始処理は1つへまとまる', async () => {
      await Promise.all([
        manager.ensureStarted(),
        manager.ensureStarted(),
        manager.ensureStarted(),
      ]);

      expect(client.ensureReadAccess).toHaveBeenCalledTimes(1);
    });

    it('認証待ちが失敗した場合は listener を登録せず、次の呼出しで再試行できる', async () => {
      client.ensureReadAccess.mockRejectedValueOnce(new Error('not signed in'));

      await expect(manager.ensureStarted()).rejects.toThrow('not signed in');
      expect(client.listenQuery).not.toHaveBeenCalled();

      await manager.ensureStarted();
      expect(client.ensureReadAccess).toHaveBeenCalledTimes(2);
      expect(client.listenQuery.mock.calls.length).toBeGreaterThan(0);
    });

    it('listener登録途中の失敗では登録済みlistenerを解除して再試行可能な状態へ戻す', async () => {
      const stop = vi.fn();
      client.listenQuery
        .mockImplementationOnce(() => stop)
        .mockImplementationOnce(() => {
          throw new Error('listen failed');
        });

      await expect(manager.ensureStarted()).rejects.toThrow('listen failed');
      expect(stop).toHaveBeenCalledTimes(1);

      // started を残さないため、次の呼出しで最初から登録し直せる
      await manager.ensureStarted();
      expect(client.ensureReadAccess).toHaveBeenCalledTimes(2);
    });
  });

  describe('削除済みを含む内部取得（設計4.7）', () => {
    it('getCachedDocIncludingDeleted は削除済み行も返し、公開 getDoc は除外し続ける', async () => {
      await cacheDao.upsertFirestoreStoredDoc({
        path: 'storageList/firstGrade/images/img1',
        collection_path: 'storageList/firstGrade/images',
        doc_id: 'img1',
        data: { deleted: true, md5Hash: 'md5AAA' },
        updated_seconds: 5,
        updated_nanos: 0,
        deleted: 1,
      } as never);

      await expect(
        manager.getCachedDocIncludingDeleted(
          'storageList/firstGrade/images/img1',
        ),
      ).resolves.toMatchObject({ kind: 'deleted' });

      await expect(
        manager.getDoc('storageList/firstGrade/images/img1'),
      ).resolves.toBeNull();
    });

    it('ローカルcacheに無い場合は not-found を返す', async () => {
      await expect(
        manager.getCachedDocIncludingDeleted('storageList/firstGrade/images/x'),
      ).resolves.toEqual({ kind: 'not-found' });
    });

    it('getDocFromServerIncludingDeleted は ensureStarted を通してから client を呼ぶ', async () => {
      const docPath = 'storageList/firstGrade/images/img2';
      client.serverDocs.set(
        docPath,
        makeDoc('storageList/firstGrade/images', 'img2', 9, {
          md5Hash: 'md5BBB',
        }),
      );

      const result = await manager.getDocFromServerIncludingDeleted(docPath);

      expect(client.ensureReadAccess).toHaveBeenCalled();
      expect(client.getDocFromServerIncludingDeleted).toHaveBeenCalledWith(
        docPath,
      );
      expect(result).toMatchObject({ kind: 'active' });
    });
  });

  describe('index snapshot の受信順処理（設計6.4）', () => {
    it('先の反映が終わるまで後続通知を並行反映しない', async () => {
      await manager.ensureStarted();

      let releaseFirst: () => void = () => {};
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const requestedPaths: string[] = [];

      client.getDoc.mockImplementation(async (path: string) => {
        requestedPaths.push(path);
        if (requestedPaths.length === 1) {
          await firstGate;
        }
        return makeDoc('firstGrade', path.split('/')[1], 3, { title: 'x' });
      });

      client.emitIndexChange('firstGrade', [
        { type: 'modified', doc: makeIndexSnapshot('firstGrade', 'doc1', 3) },
      ]);
      client.emitIndexChange('firstGrade', [
        { type: 'modified', doc: makeIndexSnapshot('firstGrade', 'doc2', 4) },
      ]);

      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      // 1件目が完了していないため、2件目のdoc取得は始まっていない
      expect(requestedPaths).toEqual(['firstGrade/doc1']);

      releaseFirst();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(requestedPaths).toEqual(['firstGrade/doc1', 'firstGrade/doc2']);
    });
  });
});

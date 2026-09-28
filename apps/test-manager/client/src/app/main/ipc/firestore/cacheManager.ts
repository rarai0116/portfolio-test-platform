import type {
  CachedDoc,
  FirestoreCacheMetrics,
  FirestoreIndexItemRow,
  FirestoreIndexShardReplacement,
  FirestoreQuerySpec,
  FirestoreStoredDocMutation,
  FirestoreSyncStateRow,
  Version,
} from '@shared/types/contracts';
import type { CacheDao } from './cacheDao';
import type { FirestoreClient, FirestoreDocLookup } from './clients';
import type { CollectionCacheDefinition } from './collectionDefinitions';
import {
  buildIndexDocId,
  getCollectionDefinition,
  TESTDATA_COLLECTIONS,
} from './collectionDefinitions';
import { assertSupportedLocalQuery } from './localQueryGuard';

type CollectionChangedHandler = (docs: CachedDoc[]) => void;

const createInitialMetrics = (): FirestoreCacheMetrics => ({
  remote: {
    fullSyncCount: 0,
    deltaFetchDocCount: 0,
    indexSnapshotCount: 0,
    returnedDocCount: 0,
  },
  local: {
    queryCount: 0,
    getDocCount: 0,
    returnedDocCount: 0,
  },
  cache: {
    hitCount: 0,
    missCount: 0,
  },
  sync: {
    rebuildCount: 0,
    lastReason: undefined,
  },
  asset: {
    localFileHitCount: 0,
    localFileMissCount: 0,
    base64EmitCount: 0,
    downloadCount: 0,
    downloadBytes: 0,
    metaCacheHitCount: 0,
    metaInvalidationCount: 0,
    lastInvalidationReason: undefined,
  },
});
const cloneMetrics = (
  metrics: FirestoreCacheMetrics,
): FirestoreCacheMetrics => ({
  remote: { ...metrics.remote },
  local: { ...metrics.local },
  cache: { ...metrics.cache },
  sync: { ...metrics.sync },
  asset: { ...metrics.asset },
});

const calcCacheHitRate = (metrics: FirestoreCacheMetrics): number | null => {
  const total = metrics.cache.hitCount + metrics.cache.missCount;
  if (total === 0) {
    return null;
  }
  return Number((metrics.cache.hitCount / total).toFixed(3));
};

const toCachedDoc = (row: {
  path: string;
  doc_id: string;
  data: unknown;
  updated_seconds: number;
  updated_nanos: number;
}): CachedDoc => ({
  key: row.doc_id,
  path: row.path,
  data: row.data,
  updateTime: {
    seconds: row.updated_seconds,
    nanos: row.updated_nanos,
  },
});

export const hashDocId = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const isLogicalDeleted = (data: unknown): boolean => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  return (data as { deleted?: unknown }).deleted === true;
};

export const toShardSuffix = (docId: string, shardCount: number): string => {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
};

const toShardPath = (
  definition: CollectionCacheDefinition,
  docId: string,
): string =>
  `${definition.indexCollectionPath}/${buildIndexDocId(
    definition,
    toShardSuffix(docId, definition.shardCount),
  )}`;

const readVersionLike = (value: unknown): Version | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as {
    seconds?: unknown;
    nanos?: unknown;
    nanoseconds?: unknown;
  };

  if (typeof candidate.seconds !== 'number') {
    return null;
  }

  if (typeof candidate.nanos === 'number') {
    return {
      seconds: candidate.seconds,
      nanos: candidate.nanos,
    };
  }

  if (typeof candidate.nanoseconds === 'number') {
    return {
      seconds: candidate.seconds,
      nanos: candidate.nanoseconds,
    };
  }

  return null;
};

const toIndexRowsFromSnapshot = (
  shardSnapshot: CachedDoc,
  collectionPath: string,
): FirestoreIndexItemRow[] => {
  if (
    !shardSnapshot.data ||
    typeof shardSnapshot.data !== 'object' ||
    Array.isArray(shardSnapshot.data)
  ) {
    return [];
  }

  const items = (shardSnapshot.data as { items?: unknown }).items;
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    return [];
  }

  const rows: FirestoreIndexItemRow[] = [];

  for (const [docId, value] of Object.entries(items)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const version = readVersionLike(
      (value as { updatedAt?: unknown }).updatedAt,
    );
    if (!version) {
      continue;
    }

    rows.push({
      shard_path: shardSnapshot.path,
      collection_path: collectionPath,
      doc_id: docId,
      updated_seconds: version.seconds,
      updated_nanos: version.nanos,
      deleted: (value as { deleted?: unknown }).deleted === true ? 1 : 0,
    });
  }

  return rows.sort((left, right) => left.doc_id.localeCompare(right.doc_id));
};

const collectChangedDocIds = (
  currentRows: FirestoreIndexItemRow[],
  nextRows: FirestoreIndexItemRow[],
): string[] => {
  const currentMap = new Map(currentRows.map((row) => [row.doc_id, row]));
  const nextMap = new Map(nextRows.map((row) => [row.doc_id, row]));
  const changed = new Set<string>();

  for (const docId of currentMap.keys()) {
    const current = currentMap.get(docId);
    const next = nextMap.get(docId);

    if (!current || !next) {
      changed.add(docId);
      continue;
    }

    if (
      current.updated_seconds !== next.updated_seconds ||
      current.updated_nanos !== next.updated_nanos ||
      current.deleted !== next.deleted
    ) {
      changed.add(docId);
    }
  }

  for (const docId of nextMap.keys()) {
    if (!currentMap.has(docId)) {
      changed.add(docId);
    }
  }

  return [...changed].sort((left, right) => left.localeCompare(right));
};

const compareVersion = (a: Version, b: Version): number => {
  if (a.seconds !== b.seconds) {
    return a.seconds - b.seconds;
  }
  return a.nanos - b.nanos;
};

const pickLastCursor = (
  docs: CachedDoc[],
): {
  lastSeenUpdatedSeconds: number | null;
  lastSeenUpdatedNanos: number | null;
  lastSeenDocId: string | null;
} => {
  if (docs.length === 0) {
    return {
      lastSeenUpdatedSeconds: null,
      lastSeenUpdatedNanos: null,
      lastSeenDocId: null,
    };
  }

  const sorted = [...docs].sort((left, right) => {
    const versionCompare = compareVersion(left.updateTime, right.updateTime);
    if (versionCompare !== 0) {
      return versionCompare;
    }
    return left.key.localeCompare(right.key);
  });

  const last = sorted[sorted.length - 1];
  return {
    lastSeenUpdatedSeconds: last.updateTime.seconds,
    lastSeenUpdatedNanos: last.updateTime.nanos,
    lastSeenDocId: last.key,
  };
};
export class FirestoreCacheManager {
  private started = false;
  private startingPromise: Promise<void> | null = null;
  private metrics: FirestoreCacheMetrics = createInitialMetrics();
  private listeners = new Map<string, Set<CollectionChangedHandler>>();
  private indexListenerStops = new Map<string, () => void>();
  // collectionごとに index snapshot の反映を受信順で直列化する（設計6.4）。
  private indexSnapshotChains = new Map<string, Promise<void>>();
  private pendingShardSnapshots = new Map<string, CachedDoc>();
  private dirtyShardPaths = new Set<string>();
  private fullSyncingCollections = new Set<string>();

  constructor(
    private cacheDao: CacheDao,
    private client: FirestoreClient,
  ) {}

  /**
   * 監視開始を保証する（設計6.4）。
   * read権限を持つ認証状態を待ち、成功した場合だけ index listener を登録して started とする。
   * 同時に複数の開始要求が来た場合は1つの開始Promiseへまとめ、
   * 認証待ち失敗や登録途中の失敗では started や開始中Promiseを残さず、
   * 次の認証済み呼出しで再試行できる状態へ戻す。
   */
  async ensureStarted(): Promise<void> {
    if (this.started) return;

    if (!this.startingPromise) {
      this.startingPromise = this.startIndexListeners().finally(() => {
        this.startingPromise = null;
      });
    }

    await this.startingPromise;
  }

  private async startIndexListeners(): Promise<void> {
    await this.client.ensureReadAccess();

    const startedPaths: string[] = [];
    try {
      for (const definition of TESTDATA_COLLECTIONS) {
        this.startIndexListenerForCollection(definition);
        startedPaths.push(definition.collectionPath);
      }
    } catch (e) {
      // 途中まで登録したlistenerを解除して、再試行可能な状態へ戻す。
      for (const collectionPath of startedPaths) {
        const stop = this.indexListenerStops.get(collectionPath);
        if (!stop) continue;
        try {
          stop();
        } catch (stopError) {
          console.warn(
            'Failed to stop firestore index listener during rollback',
            collectionPath,
            stopError,
          );
        }
        this.indexListenerStops.delete(collectionPath);
      }
      throw e;
    }

    this.started = true;
  }

  async getOnce(spec: FirestoreQuerySpec): Promise<CachedDoc[]> {
    await this.ensureStarted();
    assertSupportedLocalQuery(spec);

    const definition = getCollectionDefinition(spec.collectionPath);
    if (!definition) {
      throw new Error(`unsupported collectionPath: ${spec.collectionPath}`);
    }

    const syncState = await this.cacheDao.getFirestoreSyncStateByCollection(
      definition.collectionPath,
    );
    if (!syncState?.cache_ready) {
      await this.temporaryFullSyncCollection(
        definition.collectionPath,
        'cache-not-ready',
      );
    }

    const rows = await this.cacheDao.listFirestoreStoredDocsByCollection(
      definition.collectionPath,
    );

    const docs = rows.filter((row) => row.deleted === 0).map(toCachedDoc);

    this.metrics.local.queryCount += 1;
    this.metrics.local.returnedDocCount += docs.length;
    this.metrics.cache.hitCount += 1;

    return docs;
  }

  async getDoc(path: string): Promise<CachedDoc | null> {
    await this.ensureStarted();

    const row = await this.cacheDao.getFirestoreStoredDocByPath(path);
    this.metrics.local.getDocCount += 1;

    if (!row || row.deleted !== 0) {
      this.metrics.cache.missCount += 1;
      return null;
    }

    const doc = toCachedDoc(row);
    this.metrics.local.returnedDocCount += 1;
    this.metrics.cache.hitCount += 1;
    return doc;
  }

  /**
   * ローカルcacheから削除済みdocumentも含めて取得する（設計4.7）。
   * 画像AssetManager専用の内部APIで、公開 getDoc() の削除済み除外契約は変更しない。
   */
  async getCachedDocIncludingDeleted(
    path: string,
  ): Promise<FirestoreDocLookup> {
    await this.ensureStarted();

    const row = await this.cacheDao.getFirestoreStoredDocByPath(path);
    this.metrics.local.getDocCount += 1;

    if (!row) {
      this.metrics.cache.missCount += 1;
      return { kind: 'not-found' };
    }

    const doc = toCachedDoc(row);
    this.metrics.local.returnedDocCount += 1;
    this.metrics.cache.hitCount += 1;

    return row.deleted === 0
      ? { kind: 'active', doc }
      : { kind: 'deleted', doc };
  }

  /**
   * サーバーの現在値を削除済みも含めて取得する（設計4.7）。
   * ensureStarted() を通してからclientを呼ぶ。
   */
  async getDocFromServerIncludingDeleted(
    path: string,
  ): Promise<FirestoreDocLookup> {
    await this.ensureStarted();

    return this.client.getDocFromServerIncludingDeleted(path);
  }

  async syncCacheIndexEntries(params: {
    collectionPath: string;
    docIds: string[];
  }): Promise<{
    collectionPath: string;
    requestedDocCount: number;
    syncedDocCount: number;
    touchedShardCount: number;
  }> {
    await this.ensureStarted();

    const definition = getCollectionDefinition(params.collectionPath);
    if (!definition) {
      throw new Error(
        `Unsupported cacheManager collectionPath: ${params.collectionPath}`,
      );
    }

    const docIds = [...new Set(params.docIds.map((docId) => docId.trim()))]
      .filter(Boolean)
      .sort();

    if (docIds.length === 0) {
      return {
        collectionPath: definition.collectionPath,
        requestedDocCount: 0,
        syncedDocCount: 0,
        touchedShardCount: 0,
      };
    }

    const shardPaths = [
      ...new Set(docIds.map((docId) => toShardPath(definition, docId))),
    ];

    let syncedDocCount = 0;
    for (const shardPath of shardPaths) {
      const shardSnapshot = await this.client.getDoc(shardPath);
      const changedDocs = await this.applyShardSnapshot(
        definition,
        shardPath,
        shardSnapshot,
      );
      syncedDocCount += changedDocs.length;
    }

    return {
      collectionPath: definition.collectionPath,
      requestedDocCount: docIds.length,
      syncedDocCount,
      touchedShardCount: shardPaths.length,
    };
  }

  onCollectionChanged(
    collectionPath: string,
    handler: CollectionChangedHandler,
  ): () => void {
    if (!getCollectionDefinition(collectionPath)) {
      throw new Error(
        `Unsupported cacheManager collectionPath: ${collectionPath}`,
      );
    }

    const handlers = this.listeners.get(collectionPath) ?? new Set();
    handlers.add(handler);
    this.listeners.set(collectionPath, handlers);

    return () => {
      const current = this.listeners.get(collectionPath);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.listeners.delete(collectionPath);
      }
    };
  }

  getMetrics(): FirestoreCacheMetrics {
    return cloneMetrics(this.metrics);
  }

  recordAssetMetric(
    action:
      | { type: 'local-file-hit' }
      | { type: 'local-file-miss' }
      | { type: 'base64-emit' }
      | { type: 'download'; bytes: number }
      | { type: 'meta-cache-hit' }
      | { type: 'meta-invalidation'; reason: string },
  ): void {
    switch (action.type) {
      case 'local-file-hit':
        this.metrics.asset.localFileHitCount += 1;
        return;
      case 'local-file-miss':
        this.metrics.asset.localFileMissCount += 1;
        return;
      case 'base64-emit':
        this.metrics.asset.base64EmitCount += 1;
        return;
      case 'download':
        this.metrics.asset.downloadCount += 1;
        this.metrics.asset.downloadBytes += action.bytes;
        return;
      case 'meta-cache-hit':
        this.metrics.asset.metaCacheHitCount += 1;
        return;
      case 'meta-invalidation':
        this.metrics.asset.metaInvalidationCount += 1;
        this.metrics.asset.lastInvalidationReason = action.reason;
        return;
    }
  }

  logSummary(
    label: string,
    metrics: FirestoreCacheMetrics = this.getMetrics(),
  ): void {
    console.info('[firestore-cache-summary]', {
      label,
      remote: metrics.remote,
      local: metrics.local,
      cache: {
        ...metrics.cache,
        totalLookups: metrics.cache.hitCount + metrics.cache.missCount,
        hitRate: calcCacheHitRate(metrics),
      },
      sync: metrics.sync,
      asset: metrics.asset,
    });
  }

  resetMetrics(): void {
    this.metrics = createInitialMetrics();
  }

  private emitCollectionChanged(
    collectionPath: string,
    docs: CachedDoc[],
  ): void {
    if (docs.length === 0) {
      return;
    }

    const handlers = this.listeners.get(collectionPath);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      handler(docs);
    }
  }

  private startIndexListenerForCollection(
    definition: CollectionCacheDefinition,
  ): void {
    if (this.indexListenerStops.has(definition.collectionPath)) {
      return;
    }

    const stop = this.client.listenQuery(
      {
        collectionPath: definition.indexCollectionPath,
        where: [['collectionPath', '==', definition.collectionPath]],
      },
      (changes) => {
        this.metrics.remote.indexSnapshotCount += 1;

        // 受信順を守るため、collectionごとの1本のPromiseチェーンへ積む。
        // 1件の失敗はログへ残して次の通知へ進む。
        const previous =
          this.indexSnapshotChains.get(definition.collectionPath) ??
          Promise.resolve();

        const next = previous
          .then(async () => {
            for (const change of changes) {
              if (this.fullSyncingCollections.has(definition.collectionPath)) {
                if (change.type === 'removed') {
                  this.pendingShardSnapshots.delete(change.doc.path);
                  this.dirtyShardPaths.add(change.doc.path);
                  continue;
                }

                this.pendingShardSnapshots.set(change.doc.path, change.doc);
                this.dirtyShardPaths.add(change.doc.path);
                continue;
              }

              await this.applyShardSnapshot(
                definition,
                change.doc.path,
                change.type === 'removed' ? null : change.doc,
              );
            }
          })
          .catch((error) => {
            console.error(
              'Failed to apply firestore index snapshot',
              definition.collectionPath,
              error,
            );
          });

        this.indexSnapshotChains.set(definition.collectionPath, next);
      },
    );

    this.indexListenerStops.set(definition.collectionPath, stop);
  }

  private async reconcilePendingShardsAfterFullSync(
    definition: CollectionCacheDefinition,
  ): Promise<CachedDoc[]> {
    const shardPrefix = `${definition.indexCollectionPath}/${definition.collectionPath}_`;
    const targetShardPaths = [...this.dirtyShardPaths].filter((shardPath) =>
      shardPath.startsWith(shardPrefix),
    );

    const reconciledDocs: CachedDoc[] = [];

    for (const shardPath of targetShardPaths) {
      const shardSnapshot = this.pendingShardSnapshots.get(shardPath) ?? null;
      const changedDocs = await this.applyShardSnapshot(
        definition,
        shardPath,
        shardSnapshot,
      );

      reconciledDocs.push(...changedDocs);
      this.pendingShardSnapshots.delete(shardPath);
      this.dirtyShardPaths.delete(shardPath);
    }

    return reconciledDocs;
  }

  private async applyShardSnapshot(
    definition: CollectionCacheDefinition,
    shardPath: string,
    shardSnapshot: CachedDoc | null,
  ): Promise<CachedDoc[]> {
    const nextRows = shardSnapshot
      ? toIndexRowsFromSnapshot(shardSnapshot, definition.collectionPath)
      : [];
    const currentRows =
      await this.cacheDao.listFirestoreIndexItemsByShard(shardPath);
    const changedDocIds = collectChangedDocIds(currentRows, nextRows);
    const nextRowsByDocId = new Map(nextRows.map((row) => [row.doc_id, row]));

    if (changedDocIds.length === 0) {
      await this.cacheDao.replaceFirestoreIndexItemsByShard(
        shardPath,
        nextRows,
      );
      return [];
    }

    const docMutations: FirestoreStoredDocMutation[] = [];
    let remoteFetchCount = 0;
    const changedDocs: CachedDoc[] = [];

    for (const docId of changedDocIds) {
      const docPath = `${definition.collectionPath}/${docId}`;
      const nextRow = nextRowsByDocId.get(docId);

      if (!nextRow) {
        docMutations.push({
          kind: 'delete',
          path: docPath,
        });

        const currentRow = currentRows.find((row) => row.doc_id === docId);
        if (currentRow) {
          changedDocs.push({
            key: docId,
            path: docPath,
            data: { deleted: true },
            updateTime: {
              seconds: currentRow.updated_seconds,
              nanos: currentRow.updated_nanos,
            },
          });
        }
        continue;
      }

      remoteFetchCount += 1;
      const remoteDoc = await this.client.getDoc(docPath);

      if (!remoteDoc) {
        docMutations.push({
          kind: 'delete',
          path: docPath,
        });

        changedDocs.push({
          key: docId,
          path: docPath,
          data: { deleted: true },
          updateTime: {
            seconds: nextRow.updated_seconds,
            nanos: nextRow.updated_nanos,
          },
        });
        continue;
      }

      const deleted = isLogicalDeleted(remoteDoc.data) ? 1 : 0;

      docMutations.push({
        kind: 'upsert',
        row: {
          path: remoteDoc.path,
          collection_path: definition.collectionPath,
          doc_id: remoteDoc.key,
          data: remoteDoc.data ?? null,
          updated_seconds: remoteDoc.updateTime.seconds,
          updated_nanos: remoteDoc.updateTime.nanos,
          deleted,
        },
      });

      changedDocs.push(remoteDoc);
      this.metrics.remote.returnedDocCount += 1;
    }

    this.metrics.remote.deltaFetchDocCount += remoteFetchCount;

    const syncState = await this.cacheDao.getFirestoreSyncStateByCollection(
      definition.collectionPath,
    );
    const cursor = pickLastCursor(changedDocs);
    const now = Date.now();

    const nextSyncState: FirestoreSyncStateRow = {
      collection_path: definition.collectionPath,
      cache_ready: 1,
      last_full_sync_ms: syncState?.last_full_sync_ms ?? null,
      last_delta_sync_ms: now,
      last_seen_updated_seconds:
        cursor.lastSeenUpdatedSeconds ??
        syncState?.last_seen_updated_seconds ??
        null,
      last_seen_updated_nanos:
        cursor.lastSeenUpdatedNanos ??
        syncState?.last_seen_updated_nanos ??
        null,
      last_seen_doc_id:
        cursor.lastSeenDocId ?? syncState?.last_seen_doc_id ?? null,
      auto_rebuild_last_reason: syncState?.auto_rebuild_last_reason ?? null,
      auto_rebuild_same_reason_failures:
        syncState?.auto_rebuild_same_reason_failures ?? 0,
      auto_rebuild_total_failures: syncState?.auto_rebuild_total_failures ?? 0,
      auto_rebuild_last_attempt_ms:
        syncState?.auto_rebuild_last_attempt_ms ?? null,
      auto_rebuild_blocked: syncState?.auto_rebuild_blocked ?? 0,
      auto_rebuild_blocked_reason:
        syncState?.auto_rebuild_blocked_reason ?? null,
      last_rebuild_succeeded_ms: syncState?.last_rebuild_succeeded_ms ?? null,
      schema_version: syncState?.schema_version ?? 1,
    };

    await this.cacheDao.applyFirestoreLocalSyncTransaction({
      docMutations,
      indexShardReplacements: [
        {
          shardPath,
          rows: nextRows,
        },
      ],
      syncState: nextSyncState,
    });

    if (changedDocs.length > 0) {
      this.metrics.sync.lastReason = `delta-sync:${definition.collectionPath}`;
      this.logSummary(`delta-sync:${definition.collectionPath}`);
    }

    this.emitCollectionChanged(definition.collectionPath, changedDocs);
    return changedDocs;
  }

  async temporaryPrimeCollection(collectionPath: string): Promise<void> {
    await this.temporaryFullSyncCollection(
      collectionPath,
      'temporary-prime-collection',
    );
  }

  private async temporaryFullSyncCollection(
    collectionPath: string,
    reason: string,
  ): Promise<void> {
    const definition = getCollectionDefinition(collectionPath);
    if (!definition) {
      throw new Error(`unsupported collectionPath: ${collectionPath}`);
    }
    this.fullSyncingCollections.add(definition.collectionPath);

    try {
      const remoteDocs = await this.client.getOnce({
        collectionPath: definition.collectionPath,
      });

      const existingRows =
        await this.cacheDao.listFirestoreStoredDocsByCollection(
          definition.collectionPath,
        );
      // const existingPathSet = new Set(existingRows.map((row) => row.path));
      const remotePathSet = new Set(remoteDocs.map((doc) => doc.path));
      const docMutations: FirestoreStoredDocMutation[] = [];

      for (const row of existingRows) {
        if (!remotePathSet.has(row.path)) {
          docMutations.push({
            kind: 'delete',
            path: row.path,
          });
        }
      }

      for (const doc of remoteDocs) {
        const deleted = isLogicalDeleted(doc.data) ? 1 : 0;

        docMutations.push({
          kind: 'upsert',
          row: {
            path: doc.path,
            collection_path: definition.collectionPath,
            doc_id: doc.key,
            data: doc.data ?? null,
            updated_seconds: doc.updateTime.seconds,
            updated_nanos: doc.updateTime.nanos,
            deleted,
          },
        });
      }

      const indexRowsByShard = new Map<string, FirestoreIndexItemRow[]>();

      for (const doc of remoteDocs) {
        const shardPath = toShardPath(definition, doc.key);
        const rows = indexRowsByShard.get(shardPath) ?? [];
        const deleted = isLogicalDeleted(doc.data) ? 1 : 0;

        rows.push({
          shard_path: shardPath,
          collection_path: definition.collectionPath,
          doc_id: doc.key,
          updated_seconds: doc.updateTime.seconds,
          updated_nanos: doc.updateTime.nanos,
          deleted,
        });
        indexRowsByShard.set(shardPath, rows);
      }

      const indexShardReplacements: FirestoreIndexShardReplacement[] = [];

      for (let shard = 0; shard < definition.shardCount; shard += 1) {
        const shardSuffix = shard.toString(16).padStart(2, '0');
        const shardPath = `${definition.indexCollectionPath}/${buildIndexDocId(
          definition,
          shardSuffix,
        )}`;

        indexShardReplacements.push({
          shardPath,
          rows: indexRowsByShard.get(shardPath) ?? [],
        });
      }

      const cursor = pickLastCursor(remoteDocs);
      const now = Date.now();

      await this.cacheDao.applyFirestoreLocalSyncTransaction({
        docMutations,
        indexShardReplacements,
        syncState: {
          collection_path: definition.collectionPath,
          cache_ready: 1,
          last_full_sync_ms: now,
          last_delta_sync_ms: null,
          last_seen_updated_seconds: cursor.lastSeenUpdatedSeconds,
          last_seen_updated_nanos: cursor.lastSeenUpdatedNanos,
          last_seen_doc_id: cursor.lastSeenDocId,
          auto_rebuild_last_reason: null,
          auto_rebuild_same_reason_failures: 0,
          auto_rebuild_total_failures: 0,
          auto_rebuild_last_attempt_ms: null,
          auto_rebuild_blocked: 0,
          auto_rebuild_blocked_reason: null,
          last_rebuild_succeeded_ms: now,
          schema_version: 1,
        },
      });

      await this.reconcilePendingShardsAfterFullSync(definition);

      this.metrics.remote.fullSyncCount += 1;
      this.metrics.remote.returnedDocCount += remoteDocs.length;
      this.metrics.cache.missCount += 1;
      this.metrics.sync.rebuildCount += 1;
      this.metrics.sync.lastReason = reason;
      this.logSummary(`full-sync:${definition.collectionPath}`);
    } finally {
      this.fullSyncingCollections.delete(definition.collectionPath);
    }
  }
}

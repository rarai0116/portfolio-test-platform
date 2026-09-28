import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type {
  FirestoreIndexItemRow,
  FirestoreIndexShardReplacement,
  FirestoreStoredDocMutation,
  FirestoreStoredDocRow,
  FirestoreStoredDocUpsertInput,
  FirestoreSyncStateRow,
  WorkerRequest,
  WorkerRequestEnvelope,
  WorkerResponse,
} from '@shared/types/contracts';
import { app } from 'electron';
/**
 * better-sqlite3 をワーカースレッドで動かすための DataAccessObject
 */
export class CacheDao {
  private worker: Worker;

  constructor() {
    const workerPath = fileURLToPath(
      new URL('./gb.worker.js', import.meta.url),
    );
    this.worker = new Worker(workerPath);
  }

  async init(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'app.db');
    await this.call({ type: 'init', dbPath } as WorkerRequest);
    await this.call({ type: 'ensureSchema' } as WorkerRequest);
  }

  async call<T = unknown>(msg: WorkerRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = { ...msg, requestId } as unknown as WorkerRequestEnvelope;

      const onMessage = (res: WorkerResponse) => {
        if (res.requestId !== requestId) return; // ★ 取り違え防止
        this.worker.off('message', onMessage);
        if (res.ok) resolve(res.data as T);
        else reject(new Error(res.error));
      };

      this.worker.on('message', onMessage);
      this.worker.postMessage(payload);
    });
  }

  dispose() {
    this.worker.terminate().catch(() => {});
  }

  async upsertFirestoreStoredDoc(
    row: FirestoreStoredDocUpsertInput,
  ): Promise<boolean> {
    return this.call<boolean>({ type: 'firestoreUpsertStoredDoc', row });
  }

  async deleteFirestoreStoredDoc(path: string): Promise<boolean> {
    return this.call<boolean>({ type: 'firestoreDeleteStoredDoc', path });
  }

  async getFirestoreStoredDocByPath(
    path: string,
  ): Promise<FirestoreStoredDocRow | null> {
    return this.call<FirestoreStoredDocRow | null>({
      type: 'firestoreGetStoredDocByPath',
      path,
    });
  }

  async listFirestoreStoredDocsByCollection(
    collectionPath: string,
  ): Promise<FirestoreStoredDocRow[]> {
    return this.call<FirestoreStoredDocRow[]>({
      type: 'firestoreListStoredDocsByCollection',
      collectionPath,
    });
  }
  async upsertFirestoreSyncState(row: FirestoreSyncStateRow): Promise<boolean> {
    return this.call<boolean>({ type: 'firestoreUpsertSyncState', row });
  }

  async getFirestoreSyncStateByCollection(
    collectionPath: string,
  ): Promise<FirestoreSyncStateRow | null> {
    return this.call<FirestoreSyncStateRow | null>({
      type: 'firestoreGetSyncStateByCollection',
      collectionPath,
    });
  }

  async upsertFirestoreIndexItems(
    rows: FirestoreIndexItemRow[],
  ): Promise<boolean> {
    return this.call<boolean>({ type: 'firestoreUpsertIndexItems', rows });
  }

  async replaceFirestoreIndexItemsByShard(
    shardPath: string,
    rows: FirestoreIndexItemRow[],
  ): Promise<boolean> {
    return this.call<boolean>({
      type: 'firestoreReplaceIndexItemsByShard',
      shardPath,
      rows,
    });
  }

  async listFirestoreIndexItemsByShard(
    shardPath: string,
  ): Promise<FirestoreIndexItemRow[]> {
    return this.call<FirestoreIndexItemRow[]>({
      type: 'firestoreListIndexItemsByShard',
      shardPath,
    });
  }

  async deleteFirestoreIndexItemsByShard(shardPath: string): Promise<boolean> {
    return this.call<boolean>({
      type: 'firestoreDeleteIndexItemsByShard',
      shardPath,
    });
  }

  async applyFirestoreLocalSyncTransaction(params: {
    docMutations: FirestoreStoredDocMutation[];
    indexShardReplacements: FirestoreIndexShardReplacement[];
    syncState: FirestoreSyncStateRow;
  }): Promise<boolean> {
    return this.call<boolean>({
      type: 'firestoreApplyLocalSyncTransaction',
      docMutations: params.docMutations,
      indexShardReplacements: params.indexShardReplacements,
      syncState: params.syncState,
    });
  }
}

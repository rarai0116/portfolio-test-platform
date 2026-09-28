import {
  type BatchGetDocsPayload,
  Channels,
  FirestoreQuerySpecSchema,
  type GetDocPayload,
  type GetOncePayload,
  type MutateAccepted,
  type MutatePayload,
  type OutboxItem,
  //  type MutateCommitted,
  //  type MutateFailed,
  type OutboxUpdate,
  type PatchEvent,
  type PingPayload,
  type QueryKey,
  type SetActiveKeysPayload,
  type SyncCacheIndexEntriesPayload,
} from '@shared/types/contracts';
import { ipcMain, webContents } from 'electron';
import { z } from 'zod';
import type { CacheDao } from './cacheDao';
import type { FirestoreCacheManager } from './cacheManager';
import type { FirestoreClient } from './clients';
import { getCollectionDefinition } from './collectionDefinitions';
import { LastSentStore } from './lastSentStore';
import { ListenerHub } from './listenerHub';
import { assertSupportedLocalQuery } from './localQueryGuard';
import type { FirestoreMutationExecutor } from './mutationExecutor';
import type { Outbox } from './outbox';
import { OutboxRunner } from './outbox';
import { SubscriptionRegistry } from './subscription';

export class FirestoreIpcHandlers {
  private sub = new SubscriptionRegistry();
  private lastSent = new LastSentStore();
  private hub: ListenerHub;
  private runner: OutboxRunner;
  private cacheManagerStops = new Map<QueryKey, () => void>();

  constructor(
    private client: FirestoreClient,
    private outbox: Outbox,
    private cache?: CacheDao,
    private cacheManager?: FirestoreCacheManager,
    private executor?: FirestoreMutationExecutor,
  ) {
    this.hub = new ListenerHub(client);

    this.hub.on('patch', (ev) => {
      this.broadcastPatch(ev);
    });

    // Outbox 変更をレンダラーに通知
    this.outbox.on('changed', (entry, kind) => {
      const payload: OutboxUpdate = {
        type: kind,
        item: this.toOutboxItem(entry),
      };
      this.broadcastOutbox(payload);
    });

    // 送信ワーカーを起動
    this.runner = new OutboxRunner(
      this.outbox,
      this.executor ?? {
        execute: (payload) => this.client.applyWrite(payload),
      },
      {
        intervalMs: 1000,
        batch: 8,
        visibilityTimeoutMs: 30_000,
      },
    );
    this.runner.start();
  }

  register() {
    // ウィンドウごとに Firestore の購読を管理する
    ipcMain.handle(
      Channels.setActiveKeys,
      async (_e, payload: SetActiveKeysPayload) => {
        // 簡易スキーマ検証
        z.object({
          windowId: z.number().int().positive(),
          keys: z.array(z.string()),
          specs: z.record(z.string(), FirestoreQuerySpecSchema),
        }).parse(payload);

        const diff = this.sub.setActiveKeys(
          payload.windowId,
          payload.keys,
          payload.specs,
        );
        for (const a of diff.toSubscribe) {
          if (this.shouldUseCacheManagerSubscription(a.spec)) {
            const stop = this.cacheManager?.onCollectionChanged(
              a.spec.collectionPath,
              (docs) => {
                for (const doc of docs) {
                  const isRemoved =
                    !!doc.data &&
                    typeof doc.data === 'object' &&
                    !Array.isArray(doc.data) &&
                    (doc.data as { deleted?: unknown }).deleted === true;

                  const ev: PatchEvent = {
                    key: a.key,
                    type: isRemoved ? 'removed' : 'modified',
                    doc,
                  };
                  this.broadcastPatch(ev);
                }
              },
            );

            if (stop) {
              this.cacheManagerStops.set(a.key, stop);
            }
            continue;
          }

          this.hub.add(a.key, a.spec);
        }

        for (const k of diff.toUnsubscribe) {
          if (this.sub.getRefCount(k) !== 0) {
            continue;
          }

          const stop = this.cacheManagerStops.get(k);
          if (stop) {
            stop();
            this.cacheManagerStops.delete(k);
            continue;
          }

          this.hub.remove(k);
        }
        return { ok: true };
      },
    );

    // ウィンドウが生存していることを通知する
    ipcMain.handle(Channels.ping, async (_e, payload: PingPayload) => {
      z.object({ windowId: z.number().int().positive() }).parse(payload);
      this.sub.ping(payload.windowId);
      return { ok: true };
    });

    // Firestore から一度だけドキュメントを取得する
    ipcMain.handle(Channels.getOnce, async (_e, payload: GetOncePayload) => {
      z.object({ key: z.string(), spec: FirestoreQuerySpecSchema }).parse(
        payload,
      );
      const docs = await this.getOnce(payload.spec);
      return { key: payload.key, docs };
    });

    ipcMain.handle(Channels.getDoc, async (_e, payload: GetDocPayload) => {
      z.object({ path: z.string().min(1) }).parse(payload);
      const doc = await this.getDoc(payload.path);
      return { doc };
    });

    ipcMain.handle(
      Channels.batchGetDocs,
      async (_e, payload: BatchGetDocsPayload) => {
        const parsed = z
          .object({
            paths: z.array(z.string().min(1)).max(100),
          })
          .parse(payload);

        const uniquePaths = [...new Set(parsed.paths)];
        const entries = await Promise.all(
          uniquePaths.map(
            async (path) => [path, await this.getDoc(path)] as const,
          ),
        );

        return {
          docs: Object.fromEntries(entries),
        };
      },
    );

    ipcMain.handle(
      Channels.syncCacheIndexEntries,
      async (_e, payload: SyncCacheIndexEntriesPayload) => {
        z.object({
          collectionPath: z.string().min(1),
          docIds: z.array(z.string().min(1)),
        }).parse(payload);

        if (!this.cacheManager) {
          throw new Error('cacheManager is not available');
        }

        return this.cacheManager.syncCacheIndexEntries(payload);
      },
    );

    ipcMain.handle(Channels.getFirestoreCacheMetrics, async () => {
      const metrics = this.getMetrics();
      this.cacheManager?.logSummary('ipc:getFirestoreCacheMetrics', metrics);
      return { metrics };
    });

    ipcMain.handle(Channels.resetFirestoreCacheMetrics, async () => {
      this.resetMetrics();
      return { ok: true };
    });

    // Firestore への書き込み処理を行う
    ipcMain.handle(Channels.mutate, async (_e, payload: MutatePayload) => {
      // TODO: zod 検証を詳細化
      if (!payload.mutationId) throw new Error('mutationId required');
      await this.outbox.enqueue({
        mutationId: payload.mutationId,
        path: payload.path,
        kind: payload.kind,
        data: payload.data,
      });
      /*
      await this.client.applyWrite(
        payload.kind === 'delete'
          ? { kind: 'delete', path: payload.path }
          : {
              kind: payload.kind,
              path: payload.path,
              data: payload.data,
            },
      );
      */
      const accepted: MutateAccepted = {
        mutationId: payload.mutationId,
        status: 'accepted',
      };
      return accepted;
    });
    // Outbox スナップショット取得（テスト用）
    ipcMain.handle(Channels.getOutbox, async () => {
      const items = (await this.outbox.snapshot()).map((e) =>
        this.toOutboxItem(e),
      );
      const payload: OutboxUpdate = { type: 'snapshot', items };
      return payload;
    });
  }
  // main側からgetOnceを呼び出すためのメソッド（結果をキャッシュ）
  async getOnce(spec: GetOncePayload['spec']) {
    if (this.shouldUseCacheManagerQuery(spec)) {
      // biome-ignore lint/style/noNonNullAssertion: shouldUseCacheManagerQuery で cacheManager が存在することは保証されている
      return this.cacheManager!.getOnce(spec);
    }

    return this.client.getOnce(spec);
  }

  private isCacheManagerCollectionPath(collectionPath: string): boolean {
    return !!getCollectionDefinition(collectionPath);
  }

  private getCollectionPathFromDocPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    if (segments.length <= 1) {
      return '';
    }
    return segments.slice(0, -1).join('/');
  }

  async getDoc(path: string) {
    const collectionPath = this.getCollectionPathFromDocPath(path);

    if (
      this.cacheManager &&
      this.isCacheManagerCollectionPath(collectionPath)
    ) {
      return this.cacheManager.getDoc(path);
    }

    if (this.cache) {
      const row = await this.cache.getFirestoreStoredDocByPath(path);
      if (row && row.deleted === 0) {
        return {
          key: row.doc_id,
          path: row.path,
          data: row.data,
          updateTime: {
            seconds: row.updated_seconds,
            nanos: row.updated_nanos,
          },
        };
      }
    }

    return this.client.getDoc(path);
  }

  async syncCacheIndexEntries(payload: SyncCacheIndexEntriesPayload) {
    if (!this.cacheManager) {
      throw new Error('cacheManager is not available');
    }

    return this.cacheManager.syncCacheIndexEntries(payload);
  }

  getMetrics() {
    return (
      this.cacheManager?.getMetrics() ?? {
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
      }
    );
  }

  resetMetrics() {
    this.cacheManager?.resetMetrics();
  }

  private shouldUseCacheManagerQuery(spec: GetOncePayload['spec']): boolean {
    if (!this.cacheManager) {
      return false;
    }

    try {
      assertSupportedLocalQuery(spec);
    } catch {
      return false;
    }

    return !!getCollectionDefinition(spec.collectionPath);
  }

  private shouldUseCacheManagerSubscription(
    spec: GetOncePayload['spec'],
  ): boolean {
    return this.shouldUseCacheManagerQuery(spec);
  }

  // ウィンドウが閉じられたことを通知する
  onWindowDestroyed(windowId: number) {
    const keys = this.sub.dropWindow(windowId);
    for (const k of keys) {
      if (this.sub.getRefCount(k) !== 0) {
        continue;
      }

      const stop = this.cacheManagerStops.get(k);
      if (stop) {
        stop();
        this.cacheManagerStops.delete(k);
        continue;
      }

      this.hub.remove(k);
    }
    this.lastSent.clearWindow(windowId);
  }

  // 指定の購読キーに関連する変更イベントを、購読しているウィンドウに送信する
  private broadcastPatch(ev: PatchEvent) {
    // 購読者に限定して配送
    const targets = this.sub.getWindowsForKey(ev.key);
    //　const path = ev.doc.path; // reset/removed/added/modified すべて path は取れる前提
    // void this.outbox.markCommittedByPath(path);

    for (const id of targets) {
      const wc = webContents.fromId(id);
      if (!wc) continue;
      const path = ev.doc.path;
      const version = ev.doc.updateTime;

      if (ev.type !== 'removed') {
        if (!this.lastSent.shouldSend(id, path, version)) continue;
      } else {
        // 削除は必ず配送し、バージョン記録を忘れる
        this.lastSent.forgetDoc(id, path);
      }

      wc.send(Channels.patch, ev);
    }
  }

  // Outbox の変更イベントを全ウィンドウに送信する
  private broadcastOutbox(payload: OutboxUpdate) {
    for (const wc of webContents.getAllWebContents()) {
      wc.send(Channels.outboxUpdate, payload);
    }
  }

  private toOutboxItem(e: {
    mutationId: string;
    path: string;
    kind: 'create' | 'set' | 'update' | 'delete';
    status: 'pending' | 'committed' | 'failed';
    retries: number;
    createdAtMs: number;
    lastError?: string;
  }): OutboxItem {
    return {
      mutationId: e.mutationId,
      path: e.path,
      kind: e.kind,
      status: e.status,
      retries: e.retries,
      createdAtMs: e.createdAtMs,
      lastError: e.lastError,
    };
  }

  /*
  // 全てのwindowに返信する
  private replyToAll<T>(channel: string, payload: T) {
    for (const wc of webContents.getAllWebContents()) wc.send(channel, payload);
  }
  */
}

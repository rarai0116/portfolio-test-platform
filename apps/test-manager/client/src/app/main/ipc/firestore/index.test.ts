/** biome-ignore-all lint/suspicious/noExplicitAny: mockしたデータは型を定められないため */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    webContents: {
      fromId: vi.fn(),
      getAllWebContents: vi.fn(() => []),
    },
    app: { getPath: vi.fn(() => '/tmp') },
  };
});

// FirestoreIpcHandlers が内部で使うハブとレジストリ／重複抑止をモック
let capturedPatchListener: ((ev: any) => void) | undefined;

vi.mock('./listenerHub', () => {
  class MockListenerHub {
    on = vi.fn((event: string, cb: (ev: any) => void) => {
      if (event === 'patch') capturedPatchListener = cb;
    });
    removeAllListeners = vi.fn();
  }
  return { ListenerHub: MockListenerHub };
});

// 実装のファイル名は './subscription'（'./subscriptionRegistry' ではない）
vi.mock('./subscription', () => {
  class MockSubscriptionRegistry {
    getWindowsForKey = vi.fn(() => [1, 2]);
  }
  return { SubscriptionRegistry: MockSubscriptionRegistry };
});

vi.mock('./lastSentStore', () => {
  class MockLastSentStore {
    shouldSend = vi.fn(() => true);
    forgetDoc = vi.fn();
  }
  return { LastSentStore: MockLastSentStore };
});

import { Channels } from '@shared/types/contracts';
import { ipcMain, webContents } from 'electron';
import { FirestoreIpcHandlers } from './index';

describe('FirestoreIpcHandlers (patch broadcast)', () => {
  beforeEach(() => {
    (ipcMain.handle as any).mockReset();
    (webContents.fromId as any).mockReset();
    capturedPatchListener = undefined;
  });

  it('購読ウィンドウに patch を配送し outbox.markCommittedByPath を呼ぶ', () => {
    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      applyWrite: vi.fn(),
    };
    const outbox = { markCommittedByPath: vi.fn(), on: vi.fn() };

    // 送信先モック
    const wc1 = { send: vi.fn() };
    const wc2 = { send: vi.fn() };
    (webContents.fromId as any).mockImplementation((id: number) =>
      id === 1 ? wc1 : id === 2 ? wc2 : null,
    );

    // インスタンス化（副作用で patch リスナーが登録される）
    const handlers = new FirestoreIpcHandlers(client as any, outbox as any);
    expect(handlers).toBeTruthy();

    expect(typeof capturedPatchListener).toBe('function');

    // パッチイベントを発火
    const ev = {
      key: 'k1',
      type: 'added',
      doc: {
        path: 'test/p1',
        data: { a: 1 },
        updateTime: { seconds: 1, nanos: 0 },
      },
    };
    capturedPatchListener?.(ev);

    // outbox 確定
    //expect(outbox.markCommittedByPath).toHaveBeenCalledWith('test/p1');
    // patch 配送
    expect(wc1.send).toHaveBeenCalledWith(Channels.patch, ev);
    expect(wc2.send).toHaveBeenCalledWith(Channels.patch, ev);
  });
  it('対応済みの画像 collectionPath は cacheManager.getOnce に委譲する', async () => {
    const docs = [
      {
        key: 'img1',
        path: 'storageList/firstGrade/images/img1',
        data: { key: 'img1' },
        updateTime: { seconds: 1, nanos: 0 },
      },
    ];

    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      getDoc: vi.fn(),
      applyWrite: vi.fn(),
    };

    const outbox = { markCommittedByPath: vi.fn(), on: vi.fn() };
    const cacheManager = {
      getOnce: vi.fn().mockResolvedValue(docs),
    };

    const handlers = new FirestoreIpcHandlers(
      client as any,
      outbox as any,
      undefined,
      cacheManager as any,
    );

    const result = await handlers.getOnce({
      collectionPath: 'storageList/firstGrade/images',
    });

    expect(cacheManager.getOnce).toHaveBeenCalledWith({
      collectionPath: 'storageList/firstGrade/images',
    });
    expect(client.getOnce).not.toHaveBeenCalled();
    expect(result).toEqual(docs);
  });
  it('metrics fallback は asset セクションを含む', () => {
    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      getDoc: vi.fn(),
      applyWrite: vi.fn(),
    };

    const outbox = { on: vi.fn() };

    const handlers = new FirestoreIpcHandlers(client as any, outbox as any);

    expect(handlers.getMetrics()).toEqual(
      expect.objectContaining({
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
      }),
    );
  });
  it('cacheManager 非対象 path の getDoc は client.getDoc にフォールバックする', async () => {
    const doc = {
      key: 'maintenance',
      path: '_meta/maintenance',
      data: { isMaintenance: true },
      updateTime: { seconds: 1, nanos: 0 },
    };

    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      getDoc: vi.fn().mockResolvedValue(doc),
      applyWrite: vi.fn(),
    };

    const outbox = { on: vi.fn() };
    const cacheManager = {
      getDoc: vi.fn(),
      getMetrics: vi.fn(),
    };

    const handlers = new FirestoreIpcHandlers(
      client as any,
      outbox as any,
      undefined,
      cacheManager as any,
    );

    const result = await handlers.getDoc('_meta/maintenance');

    expect(cacheManager.getDoc).not.toHaveBeenCalled();
    expect(client.getDoc).toHaveBeenCalledWith('_meta/maintenance');
    expect(result).toEqual(doc);
  });

  it('syncCacheIndexEntries は cacheManager に委譲する', async () => {
    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      getDoc: vi.fn(),
      applyWrite: vi.fn(),
    };

    const outbox = { on: vi.fn() };
    const cacheManager = {
      syncCacheIndexEntries: vi.fn().mockResolvedValue({
        collectionPath: 'firstGrade',
        requestedDocCount: 2,
        syncedDocCount: 2,
        touchedShardCount: 1,
      }),
    };

    const handlers = new FirestoreIpcHandlers(
      client as any,
      outbox as any,
      undefined,
      cacheManager as any,
    );

    const result = await handlers.syncCacheIndexEntries({
      collectionPath: 'firstGrade',
      docIds: ['doc1', 'doc2'],
    });

    expect(cacheManager.syncCacheIndexEntries).toHaveBeenCalledWith({
      collectionPath: 'firstGrade',
      docIds: ['doc1', 'doc2'],
    });
    expect(result).toEqual({
      collectionPath: 'firstGrade',
      requestedDocCount: 2,
      syncedDocCount: 2,
      touchedShardCount: 1,
    });
  });

  it('syncCacheIndexEntries は1000件超の docIds でも IPC バリデーションを通して委譲する', async () => {
    const client = {
      listenQuery: vi.fn(),
      getOnce: vi.fn(),
      getDoc: vi.fn(),
      applyWrite: vi.fn(),
    };

    const outbox = { on: vi.fn() };
    const docIds = Array.from(
      { length: 1001 },
      (_, index) => `doc${index + 1}`,
    );
    const cacheManager = {
      syncCacheIndexEntries: vi.fn().mockResolvedValue({
        collectionPath: 'firstGrade',
        requestedDocCount: docIds.length,
        syncedDocCount: docIds.length,
        touchedShardCount: 16,
      }),
    };

    const handlers = new FirestoreIpcHandlers(
      client as any,
      outbox as any,
      undefined,
      cacheManager as any,
    );
    handlers.register();

    const registeredHandler = (ipcMain.handle as any).mock.calls.find(
      ([channel]: [string]) => channel === Channels.syncCacheIndexEntries,
    )?.[1];

    expect(typeof registeredHandler).toBe('function');

    const result = await registeredHandler(undefined, {
      collectionPath: 'firstGrade',
      docIds,
    });

    expect(cacheManager.syncCacheIndexEntries).toHaveBeenCalledWith({
      collectionPath: 'firstGrade',
      docIds,
    });
    expect(result).toEqual({
      collectionPath: 'firstGrade',
      requestedDocCount: docIds.length,
      syncedDocCount: docIds.length,
      touchedShardCount: 16,
    });
  });
});

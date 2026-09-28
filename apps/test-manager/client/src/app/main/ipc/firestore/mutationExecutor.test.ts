import { toShardSuffix } from '@main/ipc/firestore/cacheManager';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensureAuthClaimsMock,
  docMock,
  runTransactionMock,
  serverTimestampMock,
} = vi.hoisted(() => {
  return {
    ensureAuthClaimsMock: vi.fn().mockResolvedValue(undefined),
    docMock: vi.fn(),
    runTransactionMock: vi.fn(),
    serverTimestampMock: vi.fn(() => ({ __type: 'serverTimestamp' })),
  };
});

vi.mock('@main/services/firebase', () => {
  return {
    ensureAuthClaims: ensureAuthClaimsMock,
    firestore: { __name: 'mock-firestore' },
  };
});

vi.mock('firebase/firestore', () => {
  return {
    doc: docMock,
    runTransaction: runTransactionMock,
    serverTimestamp: serverTimestampMock,
  };
});

import { FirestoreIndexMutationExecutor } from './mutationExecutor';

type StoredSnapshot = {
  exists: boolean;
  data: Record<string, unknown>;
};

describe('FirestoreIndexMutationExecutor', () => {
  const store = new Map<string, StoredSnapshot>();

  beforeEach(() => {
    ensureAuthClaimsMock.mockClear();
    docMock.mockReset();
    runTransactionMock.mockReset();
    serverTimestampMock.mockClear();
    store.clear();

    docMock.mockImplementation((_firestore, ...parts: string[]) => {
      return {
        path: parts.length === 1 ? parts[0] : parts.join('/'),
      };
    });

    runTransactionMock.mockImplementation(async (_firestore, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          const row = store.get(ref.path);
          return {
            exists: () => !!row?.exists,
            data: () => row?.data ?? {},
          };
        }),
        set: vi.fn(
          (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => {
            const prev = store.get(ref.path);
            const next =
              options?.merge && prev
                ? {
                    ...prev.data,
                    ...data,
                  }
                : data;

            store.set(ref.path, {
              exists: true,
              data: next,
            });
          },
        ),
        update: vi.fn(
          (ref: { path: string }, data: Record<string, unknown>) => {
            const prev = store.get(ref.path);
            if (!prev?.exists) {
              throw new Error(`Document does not exist: ${ref.path}`);
            }

            store.set(ref.path, {
              exists: true,
              data: {
                ...prev.data,
                ...data,
              },
            });
          },
        ),
      };

      return callback(tx);
    });
  });

  it('create で本体と cacheIndex を同時更新する', async () => {
    const client = {
      applyWrite: vi.fn(),
    };

    const executor = new FirestoreIndexMutationExecutor(client as never);

    await executor.execute({
      kind: 'create',
      path: 'firstGrade/doc1',
      data: {
        title: '新規作成',
      },
    });

    const shard = toShardSuffix('doc1', 16);
    const indexPath = `cacheIndex/firstGrade_${shard}`;
    const indexRow = store.get(indexPath);

    expect(ensureAuthClaimsMock).toHaveBeenCalled();

    const docRow = store.get('firstGrade/doc1');
    expect(docRow?.exists).toBe(true);
    expect(docRow?.data.title).toBe('新規作成');
    expect(docRow?.data.deleted).toBe(false);
    expect(indexRow).toBeTruthy();
    expect(indexRow?.data.collectionPath).toBe('firstGrade');
    expect(indexRow?.data.items).toMatchObject({
      doc1: {
        deleted: false,
      },
    });

    expect(client.applyWrite).not.toHaveBeenCalled();
  });

  it('create 重複時は transaction 外で重複エラーを返す', async () => {
    store.set('firstGrade/doc1', {
      exists: true,
      data: {
        title: '既存データ',
        deleted: false,
      },
    });

    runTransactionMock.mockImplementationOnce(async (_firestore, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          const row = store.get(ref.path);
          return {
            exists: () => !!row?.exists,
            data: () => row?.data ?? {},
          };
        }),
        set: vi.fn(),
        update: vi.fn(),
      };

      return callback(tx);
    });

    const client = {
      applyWrite: vi.fn(),
    };

    const executor = new FirestoreIndexMutationExecutor(client as never);

    await expect(
      executor.execute({
        kind: 'create',
        path: 'firstGrade/doc1',
        data: {
          title: '重複作成',
        },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Document already exists/),
    });

    expect(store.get('firstGrade/doc1')?.data.title).toBe('既存データ');
    expect(client.applyWrite).not.toHaveBeenCalled();
  });

  it('update で cacheIndex の対象 key を更新する', async () => {
    store.set('firstGrade/doc1', {
      exists: true,
      data: {
        title: '更新前',
        deleted: false,
      },
    });

    const shard = toShardSuffix('doc1', 16);
    const indexPath = `cacheIndex/firstGrade_${shard}`;

    store.set(indexPath, {
      exists: true,
      data: {
        collectionPath: 'firstGrade',
        shard,
        items: {},
      },
    });

    const client = {
      applyWrite: vi.fn(),
    };

    const executor = new FirestoreIndexMutationExecutor(client as never);

    await executor.execute({
      kind: 'update',
      path: 'firstGrade/doc1',
      data: {
        title: '更新後',
      },
    });

    const docRow = store.get('firstGrade/doc1');
    expect(docRow?.data.title).toBe('更新後');
    expect(docRow?.data.deleted).toBe(false);

    const indexRow = store.get(indexPath);
    expect(indexRow?.data.items).toMatchObject({
      doc1: {
        deleted: false,
      },
    });
  });

  it('delete 意図を logical delete に変換する', async () => {
    store.set('firstGrade/doc1', {
      exists: true,
      data: {
        title: '削除対象',
        deleted: false,
      },
    });

    const client = {
      applyWrite: vi.fn(),
    };

    const executor = new FirestoreIndexMutationExecutor(client as never);

    await executor.execute({
      kind: 'delete',
      path: 'firstGrade/doc1',
    });

    const docRow = store.get('firstGrade/doc1');
    expect(docRow?.exists).toBe(true);
    expect(docRow?.data.deleted).toBe(true);

    const shard = toShardSuffix('doc1', 16);
    const indexPath = `cacheIndex/firstGrade_${shard}`;
    const indexRow = store.get(indexPath);

    expect(indexRow?.data.items).toMatchObject({
      doc1: {
        deleted: true,
      },
    });

    expect(client.applyWrite).not.toHaveBeenCalled();
  });

  it('画像 collection でも本体と cacheIndex を同時更新する', async () => {
    const client = {
      applyWrite: vi.fn(),
    };

    const executor = new FirestoreIndexMutationExecutor(client as never);

    await executor.execute({
      kind: 'set',
      path: 'storageList/firstGrade/images/img1',
      data: {
        key: 'img1',
        grade: 'firstGrade',
        objectPath: 'original/firstGrade/img1.png',
      },
    });

    const docRow = store.get('storageList/firstGrade/images/img1');
    expect(docRow?.exists).toBe(true);

    const shard = toShardSuffix('img1', 16);
    const indexPath = `cacheIndex/storageList_firstGrade_images_${shard}`;
    const indexRow = store.get(indexPath);

    expect(indexRow).toBeTruthy();
    expect(indexRow?.data.collectionPath).toBe('storageList/firstGrade/images');
    expect(indexRow?.data.items).toMatchObject({
      img1: {
        deleted: false,
      },
    });

    expect(client.applyWrite).not.toHaveBeenCalled();
  });
});

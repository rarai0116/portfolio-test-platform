import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensureAuthClaimsMock,
  docMock,
  getDocFromServerMock,
  runTransactionMock,
  serverTimestampMock,
  updateDocMock,
} = vi.hoisted(() => ({
  ensureAuthClaimsMock: vi.fn().mockResolvedValue(undefined),
  docMock: vi.fn(),
  getDocFromServerMock: vi.fn(),
  runTransactionMock: vi.fn(),
  serverTimestampMock: vi.fn(() => ({ __type: 'serverTimestamp' })),
  updateDocMock: vi.fn(),
}));

vi.mock('@main/services/firebase', () => ({
  auth: { currentUser: null },
  ensureAuthClaims: ensureAuthClaimsMock,
  firestore: { __name: 'mock-firestore' },
  functions: {},
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  doc: docMock,
  documentId: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: getDocFromServerMock,
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: runTransactionMock,
  serverTimestamp: serverTimestampMock,
  startAfter: vi.fn(),
  updateDoc: updateDocMock,
  where: vi.fn(),
}));

import { FirebaseFirestoreClient } from './clients';

type StoredSnapshot = {
  exists: boolean;
  data: Record<string, unknown>;
};

describe('FirebaseFirestoreClient create', () => {
  const store = new Map<string, StoredSnapshot>();

  beforeEach(() => {
    ensureAuthClaimsMock.mockClear();
    docMock.mockReset();
    runTransactionMock.mockReset();
    serverTimestampMock.mockClear();
    updateDocMock.mockReset();
    store.clear();

    docMock.mockImplementation((_firestore, ...parts: string[]) => ({
      path: parts.length === 1 ? parts[0] : parts.join('/'),
    }));

    runTransactionMock.mockImplementation(async (_firestore, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          const row = store.get(ref.path);
          return {
            exists: () => !!row?.exists,
            data: () => row?.data ?? {},
          };
        }),
        set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, {
            exists: true,
            data,
          });
        }),
      };

      return callback(tx);
    });
  });

  it('create 重複時は transaction 外で重複エラーを返す', async () => {
    const client = new FirebaseFirestoreClient({ __name: 'mock-fs' } as never);
    const path = 'storageList/firstGrade/images/create-only-1';

    await client.applyWrite({
      kind: 'create',
      path,
      data: {
        key: 'create-only-1',
        grade: 'firstGrade',
        name: 'created-by-create',
      },
    });

    await expect(
      client.applyWrite({
        kind: 'create',
        path,
        data: {
          key: 'create-only-1',
          grade: 'firstGrade',
          name: 'should-not-overwrite',
        },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Document already exists/),
    });

    expect(store.get(path)?.data.name).toBe('created-by-create');
    expect(ensureAuthClaimsMock).toHaveBeenCalled();
  });
});

describe('FirebaseFirestoreClient 内部取得API（設計4.7）', () => {
  beforeEach(() => {
    ensureAuthClaimsMock.mockClear();
    docMock.mockReset();
    getDocFromServerMock.mockReset();
    docMock.mockImplementation((_firestore, path: string) => ({ path }));
  });

  const clientWithSnapshot = (snapshot: {
    exists: boolean;
    data?: Record<string, unknown>;
    id?: string;
    path?: string;
  }) => {
    getDocFromServerMock.mockResolvedValue({
      exists: () => snapshot.exists,
      data: () => snapshot.data ?? {},
      id: snapshot.id ?? 'img1',
      ref: { path: snapshot.path ?? 'storageList/firstGrade/images/img1' },
    });
    return new FirebaseFirestoreClient({ __name: 'mock-fs' } as never);
  };

  it('存在する有効なdocumentは active として返す', async () => {
    const client = clientWithSnapshot({
      exists: true,
      data: { md5Hash: 'md5AAA', updatedAt: { seconds: 3, nanoseconds: 0 } },
    });

    const result = await client.getDocFromServerIncludingDeleted(
      'storageList/firstGrade/images/img1',
    );

    expect(result.kind).toBe('active');
    expect(ensureAuthClaimsMock).toHaveBeenCalledWith(
      expect.objectContaining({ requireRead: true }),
    );
  });

  it('削除済みdocumentは deleted として返す（除外しない）', async () => {
    const client = clientWithSnapshot({
      exists: true,
      data: { deleted: true, md5Hash: 'md5AAA' },
    });

    const result = await client.getDocFromServerIncludingDeleted(
      'storageList/firstGrade/images/img1',
    );

    expect(result.kind).toBe('deleted');
    expect(result.kind === 'deleted' && result.doc.data).toMatchObject({
      deleted: true,
    });
  });

  it('存在しないdocumentは not-found を返す', async () => {
    const client = clientWithSnapshot({ exists: false });

    await expect(
      client.getDocFromServerIncludingDeleted(
        'storageList/firstGrade/images/img1',
      ),
    ).resolves.toEqual({ kind: 'not-found' });
  });

  it('通信・認証失敗は例外として上位へ伝える', async () => {
    getDocFromServerMock.mockRejectedValue(new Error('unavailable'));
    docMock.mockImplementation((_firestore, path: string) => ({ path }));
    const client = new FirebaseFirestoreClient({ __name: 'mock-fs' } as never);

    await expect(
      client.getDocFromServerIncludingDeleted(
        'storageList/firstGrade/images/img1',
      ),
    ).rejects.toThrow('unavailable');
  });

  it('ensureReadAccess は read権限の確認を待つ', async () => {
    const client = new FirebaseFirestoreClient({ __name: 'mock-fs' } as never);

    await client.ensureReadAccess();

    expect(ensureAuthClaimsMock).toHaveBeenCalledWith(
      expect.objectContaining({ requireRead: true }),
    );
  });
});

/** biome-ignore-all lint/suspicious/noExplicitAny: テスト用モックのため */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getAllWindows: vi.fn(),
  httpsCallable: vi.fn(),
  downloadWithVerify: vi.fn(),
  uploadBytes: vi.fn(),
  getMetadata: vi.fn(),
  deleteObject: vi.fn(),
  getDoc: vi.fn(),
  ensureAuthClaims: vi.fn(),
  clearCache: vi.fn(),
  verifyAssetFile: vi.fn(),
  ensureGradeDirectory: vi.fn(),
  verifyClearTarget: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  BrowserWindow: { getAllWindows: mocks.getAllWindows },
  session: { defaultSession: { clearCache: mocks.clearCache } },
}));

vi.mock('better-sqlite3', () => ({
  default: class {
    pragma() {}
    prepare() {
      return { run: () => {}, get: () => undefined, all: () => [] };
    }
    transaction(fn: () => void) {
      return fn;
    }
    close() {}
  },
}));

vi.mock('./localAsset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./localAsset')>()),
  initializeAssetRoot: vi.fn(async () => ({ root: '/tmp/assets' })),
  verifyAssetFile: mocks.verifyAssetFile,
  // 学年ディレクトリ検証は localAsset.test.ts が担当するため、ここでは成功扱いにする
  ensureGradeDirectory: mocks.ensureGradeDirectory,
  // 削除対象の検証は localAsset.test.ts と実FSテストが担当する
  verifyClearTarget: mocks.verifyClearTarget,
}));

vi.mock('./downloader', () => ({
  downloadWithVerify: mocks.downloadWithVerify,
}));

vi.mock('@main/services/firebase', () => ({
  ensureAuthClaims: mocks.ensureAuthClaims,
  firestore: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage, objectPath) => ({ objectPath })),
  uploadBytes: mocks.uploadBytes,
  getMetadata: mocks.getMetadata,
  deleteObject: mocks.deleteObject,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_firestore, ...parts) => parts.join('/')),
  getDoc: mocks.getDoc,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

import { AssetChannels } from '@shared/types/assets';
import type { AssetData } from '@shared/types/contracts';
import {
  AssetManager,
  type AssetManagerDeps,
  type AssetMetaResolveResult,
} from './assetManager';
import type { AssetDB, AssetRow } from './db';

/** テスト用のインメモリAssetDB */
class FakeDB {
  rows = new Map<string, AssetRow>();

  private id(grade: string, key: string) {
    return `${grade}/${key}`;
  }

  seed(row: Partial<AssetRow> & { grade: string; key: string }) {
    this.rows.set(this.id(row.grade, row.key), row as AssetRow);
  }

  get(grade: string, key: string) {
    return this.rows.get(this.id(grade, key));
  }

  upsertMeta(row: Partial<AssetRow> & { grade: string; key: string }) {
    const current = this.get(row.grade, row.key) ?? ({} as AssetRow);
    const next = { ...current } as Record<string, unknown>;
    for (const [field, value] of Object.entries(row)) {
      // COALESCE 相当。null/undefined は既存値を維持する。
      if (value !== null && value !== undefined) {
        next[field] = value;
      }
    }
    this.rows.set(this.id(row.grade, row.key), next as AssetRow);
  }

  setStatus(
    grade: string,
    key: string,
    status: AssetRow['status'],
    lastError?: string,
  ) {
    const current = this.get(grade, key) ?? ({ grade, key } as AssetRow);
    this.rows.set(this.id(grade, key), {
      ...current,
      status,
      last_error: lastError ?? null,
    });
  }

  setLocalPath(grade: string, key: string, localPath: string) {
    const current = this.get(grade, key) ?? ({ grade, key } as AssetRow);
    this.rows.set(this.id(grade, key), {
      ...current,
      local_file_path: localPath,
    });
  }

  touchAccess(grade: string, key: string) {
    const current = this.get(grade, key);
    if (current) {
      current.last_accessed_at_ms = 1;
    }
  }

  markDeleted(grade: string, key: string, updatedAtMs?: number) {
    const current = this.get(grade, key) ?? ({ grade, key } as AssetRow);
    this.rows.set(this.id(grade, key), {
      ...current,
      deleted: 1,
      local_file_path: null,
      status: null,
      last_error: null,
      updated_at_ms: updatedAtMs ?? current.updated_at_ms ?? null,
    });
  }

  markActive(grade: string, key: string, updatedAtMs?: number) {
    const current = this.get(grade, key) ?? ({ grade, key } as AssetRow);
    this.rows.set(this.id(grade, key), {
      ...current,
      deleted: 0,
      updated_at_ms: updatedAtMs ?? current.updated_at_ms ?? null,
    });
  }

  clearLocalCacheEntry(grade: string, key: string) {
    const current = this.get(grade, key);
    if (current) {
      current.local_file_path = null;
      current.status = null;
      current.last_error = null;
    }
    return 1;
  }

  clearAllLocal(grade?: string) {
    for (const row of this.rows.values()) {
      if (grade && row.grade !== grade) continue;
      row.local_file_path = null;
      row.status = null;
    }
    return this.rows.size;
  }

  delete() {
    return 0;
  }

  close() {}
}

const mainWindow = {
  isDestroyed: () => false,
  webContents: { isDestroyed: () => false, send: mocks.send },
} as any;

const activeMeta = (
  grade: 'firstGrade' | 'secondGrade',
  key: string,
  md5: string,
): AssetMetaResolveResult => ({
  kind: 'found-active',
  data: {
    grade,
    key,
    objectPath: `original/${grade}/${key}.png`,
    md5Hash: md5,
    contentType: 'image/png',
    size: 10,
  } as AssetData,
});

const createManager = (
  db: FakeDB,
  overrides: Partial<AssetManagerDeps> = {},
  concurrency = 1,
) => {
  const deps: AssetManagerDeps = {
    mainWindow,
    resolveMeta: vi.fn(async (key) => activeMeta(key.grade, key.key, 'md5AAA')),
    resolveMetaFromServer: vi.fn(async (key) =>
      activeMeta(key.grade, key.key, 'md5AAA'),
    ),
    deleteFirestoreAssetDoc: vi.fn(async () => {}),
    options: { concurrency, expiresSec: 900 },
    ...overrides,
  };

  return {
    manager: new AssetManager(
      { root: '/tmp/assets' },
      db as unknown as AssetDB,
      deps,
    ),
    deps,
  };
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAllWindows.mockReturnValue([mainWindow]);
  mocks.httpsCallable.mockReturnValue(
    vi.fn(async () => ({ data: { url: 'https://example.test/signed' } })),
  );
  mocks.downloadWithVerify.mockResolvedValue({
    bytes: 10,
    md5Base64: 'md5AAA',
  });
  mocks.verifyAssetFile.mockResolvedValue({ ok: true, size: 10 });
  mocks.ensureGradeDirectory.mockResolvedValue({
    ok: true,
    path: '/tmp/assets/firstGrade',
  });
  mocks.verifyClearTarget.mockResolvedValue({
    ok: true,
    path: '/tmp/assets',
    exists: false,
  });
  mocks.clearCache.mockResolvedValue(undefined);
  mocks.ensureAuthClaims.mockResolvedValue(undefined);
});

describe('request の返却契約', () => {
  it('検証済みローカルファイルは ready、未取得は pending を返す', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'cached',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/cached.png',
      md5_hash: 'md5AAA',
      content_type: 'image/png',
    });
    db.seed({ grade: 'firstGrade', key: 'missing', deleted: 0 });

    const { manager } = createManager(db, {
      options: { concurrency: 1, expiresSec: 900 },
    });

    const result = await manager.request([
      { grade: 'firstGrade', key: 'cached' },
      { grade: 'firstGrade', key: 'missing' },
    ]);

    expect(result.ready).toHaveLength(1);
    expect(result.ready[0]).toMatchObject({
      grade: 'firstGrade',
      key: 'cached',
      version: 'md5AAA',
      contentType: 'image/png',
    });
    expect(result.pending).toEqual([{ grade: 'firstGrade', key: 'missing' }]);
    expect(result.failed).toEqual([]);
  });

  it('削除済み行はサーバー確認を経て failed(asset-deleted) になり pending へ重複しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'gone', deleted: 1 });

    const resolveMetaFromServer = vi.fn(
      async (): Promise<AssetMetaResolveResult> => ({ kind: 'found-deleted' }),
    );
    const { manager } = createManager(db, { resolveMetaFromServer });

    const result = await manager.request([
      { grade: 'firstGrade', key: 'gone' },
    ]);

    expect(resolveMetaFromServer).toHaveBeenCalledTimes(1);
    expect(result.ready).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.failed).toEqual([
      {
        grade: 'firstGrade',
        key: 'gone',
        reason: 'asset-deleted',
        message: '画像は削除されています',
      },
    ]);
  });

  it('deleted=NULL の未確認行はサーバー確認され、activeなら download 待ちの pending になる', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'unknown', deleted: null });

    const { manager, deps } = createManager(db);
    const result = await manager.request([
      { grade: 'firstGrade', key: 'unknown' },
    ]);

    // request の判定はサーバー確認（confirm-meta）だけで行い、
    // cache-first 取得は確認後に登録される download 側で使う。
    expect(deps.resolveMetaFromServer).toHaveBeenCalledTimes(1);
    expect(result.pending).toEqual([{ grade: 'firstGrade', key: 'unknown' }]);
    expect(db.get('firstGrade', 'unknown')?.deleted).toBe(0);
  });

  it('サーバー確認が not-found なら deleted=1 にして failed(asset-not-found) を返す', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'ghost',
      deleted: null,
      object_path: 'original/firstGrade/ghost.png',
    });

    const { manager } = createManager(db, {
      resolveMetaFromServer: vi.fn(async () => ({
        kind: 'not-found' as const,
      })),
    });

    const result = await manager.request([
      { grade: 'firstGrade', key: 'ghost' },
    ]);

    expect(result.failed[0].reason).toBe('asset-not-found');
    const row = db.get('firstGrade', 'ghost');
    expect(row?.deleted).toBe(1);
    // 行と既存メタは残す
    expect(row?.object_path).toBe('original/firstGrade/ghost.png');
  });

  it('サーバー確認が通信失敗なら再試行後に failed で必ず完了する', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'flaky', deleted: null });

    const resolveMetaFromServer = vi.fn(async () => ({
      kind: 'unavailable' as const,
      error: new Error('offline'),
    }));
    const { manager } = createManager(db, { resolveMetaFromServer });

    const result = await manager.request([
      { grade: 'firstGrade', key: 'flaky' },
    ]);

    // 初回 + 再試行2回
    expect(resolveMetaFromServer).toHaveBeenCalledTimes(3);
    expect(result.failed[0].reason).toBe('asset-state-unavailable');
  });
});

describe('キューの優先度と順序', () => {
  it('priority降順 → sequence昇順で実行し、実行中には割り込まない', async () => {
    const db = new FakeDB();
    for (const key of ['a', 'b', 'c']) {
      db.seed({ grade: 'firstGrade', key, deleted: 0 });
    }

    const gate = deferred<void>();
    const started: string[] = [];
    mocks.downloadWithVerify.mockImplementation(async (params: any) => {
      const key = String(params.destPath).match(/([^/\\]+)\.png$/)?.[1] ?? '';
      started.push(key);
      if (started.length === 1) {
        await gate.promise;
      }
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    const { manager } = createManager(db);
    await manager.request([
      { grade: 'firstGrade', key: 'a' },
      { grade: 'firstGrade', key: 'b' },
      { grade: 'firstGrade', key: 'c' },
    ]);
    await flush(2);

    // a が実行中。b, c は待機中
    expect(started).toEqual(['a']);

    // c を高い優先度へ上げると、待機列の先頭になる
    await manager.prioritize([{ grade: 'firstGrade', key: 'c' }], 40);
    gate.resolve();
    await flush();

    expect(started).toEqual(['a', 'c', 'b']);
  });

  it('同一画像・同一世代の重複要求は実体処理を増やさない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'dup', deleted: 0 });

    const { manager } = createManager(db);
    const gate = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await gate.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    await manager.request([{ grade: 'firstGrade', key: 'dup' }]);
    await manager.request([{ grade: 'firstGrade', key: 'dup' }]);
    await manager.prioritize([{ grade: 'firstGrade', key: 'dup' }], 20);
    gate.resolve();
    await flush();

    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
  });
});

describe('再試行', () => {
  it('中間失敗では error 通知せず、最終失敗だけ failed と error 通知を行う', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'retry', deleted: 0 });

    mocks.downloadWithVerify.mockRejectedValue(new Error('ETIMEDOUT socket'));
    const { manager } = createManager(db);

    await manager.request([{ grade: 'firstGrade', key: 'retry' }]);
    await flush(10);

    // 初回 + 再試行2回
    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(3);
    const errorSends = mocks.send.mock.calls.filter(
      (call) => call[0] === AssetChannels.error,
    );
    expect(errorSends).toHaveLength(1);
    expect(db.get('firstGrade', 'retry')?.status).toBe('failed');
  });

  it('恒久的な失敗は再試行しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'perm', deleted: 0 });

    mocks.downloadWithVerify.mockRejectedValue(
      new Error('storage/object-not-found'),
    );
    const { manager } = createManager(db);

    await manager.request([{ grade: 'firstGrade', key: 'perm' }]);
    await flush(10);

    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
    expect(db.get('firstGrade', 'perm')?.status).toBe('failed');
  });

  it('confirm-meta の失敗回数が download の再試行上限を消費しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'split', deleted: null });

    let confirmCalls = 0;
    const { manager } = createManager(db, {
      resolveMetaFromServer: vi.fn(async () => {
        confirmCalls += 1;
        return { kind: 'unavailable' as const, error: new Error('offline') };
      }),
    });

    await manager.request([{ grade: 'firstGrade', key: 'split' }]);
    await flush(10);
    expect(confirmCalls).toBe(3);

    // download 側は別カウントなので、改めて3回実行できる
    db.seed({ grade: 'firstGrade', key: 'split', deleted: 0 });
    mocks.downloadWithVerify.mockRejectedValue(new Error('ETIMEDOUT'));
    await manager.request([{ grade: 'firstGrade', key: 'split' }]);
    await flush(10);
    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(3);
  });

  it('cancel すると待機処理と再試行が復活しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'x', deleted: 0 });
    db.seed({ grade: 'firstGrade', key: 'y', deleted: 0 });

    const gate = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await gate.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    const { manager } = createManager(db);
    await manager.request([
      { grade: 'firstGrade', key: 'x' },
      { grade: 'firstGrade', key: 'y' },
    ]);
    await flush(2);

    const canceled = await manager.cancel([{ grade: 'firstGrade', key: 'y' }]);
    expect(canceled.canceled).toBe(1);

    gate.resolve();
    await flush();

    // y は実行されない
    const destPaths = mocks.downloadWithVerify.mock.calls.map((call: any) =>
      String(call[0].destPath),
    );
    expect(destPaths.some((p) => p.includes('y.png'))).toBe(false);
  });
});

describe('protocol 判定', () => {
  const readyRow = {
    grade: 'firstGrade' as const,
    key: 'p',
    deleted: 0 as const,
    status: 'ready' as const,
    local_file_path: '/tmp/assets/firstGrade/p.png',
    md5_hash: 'md5AAA',
    content_type: 'image/webp',
  };

  it('検証済みファイルは file を返し、Content-Type は DB の値を使う', async () => {
    const db = new FakeDB();
    db.seed(readyRow);
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({
        grade: 'firstGrade',
        key: 'p',
        version: 'md5AAA',
      }),
    ).resolves.toEqual({
      kind: 'file',
      filePath: readyRow.local_file_path,
      size: 10,
      contentType: 'image/webp',
    });
  });

  it('deleted=1 と deleted=NULL は not-found でダウンロードも登録しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'del', deleted: 1 });
    db.seed({ grade: 'firstGrade', key: 'nul', deleted: null });
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'del' }),
    ).resolves.toEqual({ kind: 'not-found' });
    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'nul' }),
    ).resolves.toEqual({ kind: 'not-found' });

    await flush(2);
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
  });

  it('欠損時は not-found を返し、優先度40でダウンロードを登録する', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'miss', deleted: 0 });
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'miss' }),
    ).resolves.toEqual({ kind: 'not-found' });

    await flush();
    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
  });

  it('旧version のURLには現在の内容を返さない', async () => {
    const db = new FakeDB();
    db.seed(readyRow);
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({
        grade: 'firstGrade',
        key: 'p',
        version: 'oldVersion',
      }),
    ).resolves.toEqual({ kind: 'not-found' });
  });

  it('ファイル検証に失敗した場合はローカルキャッシュ情報を無効化する', async () => {
    const db = new FakeDB();
    db.seed(readyRow);
    mocks.verifyAssetFile.mockResolvedValue({
      ok: false,
      reason: 'path-mismatch',
    });
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'p' }),
    ).resolves.toEqual({ kind: 'not-found' });
    expect(db.get('firstGrade', 'p')?.local_file_path).toBeNull();
  });
});

describe('表示失敗からの回復', () => {
  const seedReady = (db: FakeDB) =>
    db.seed({
      grade: 'firstGrade',
      key: 'r1',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/r1.png',
      md5_hash: 'md5AAA',
      content_type: 'image/png',
    });

  it('1回目の失敗で回復を開始し、r付きURLで再取得できる状態になる', async () => {
    const db = new FakeDB();
    seedReady(db);
    const { manager } = createManager(db);

    const result = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
    });

    expect(result).toEqual({ ok: true, status: 'recovery-started' });
    await flush();

    // download 完了時に r 付きの ready 通知を送る
    const readySend = mocks.send.mock.calls.find(
      (call) => call[0] === AssetChannels.ready,
    );
    expect(readySend?.[1].recoveryToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(readySend?.[1].version).toBe('md5AAA');
  });

  it('同じ失敗元tokenの重複報告は新しい処理を作らない', async () => {
    const db = new FakeDB();
    seedReady(db);
    const gate = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await gate.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });
    const { manager } = createManager(db);

    const first = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
    });
    const second = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
    });

    expect(first.ok && first.status).toBe('recovery-started');
    expect(second.ok && second.status).toBe('already-recovering');
    gate.resolve();
    await flush();
    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
  });

  it('2回まで回復し、3回目は打ち切って exhausted になる', async () => {
    const db = new FakeDB();
    seedReady(db);
    const { manager } = createManager(db);

    const first = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
    });
    await flush();
    const firstToken = mocks.send.mock.calls
      .filter((call) => call[0] === AssetChannels.ready)
      .at(-1)?.[1].recoveryToken as string;

    const second = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
      recoveryToken: firstToken,
    });
    await flush();
    const secondToken = mocks.send.mock.calls
      .filter((call) => call[0] === AssetChannels.ready)
      .at(-1)?.[1].recoveryToken as string;

    const third = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
      recoveryToken: secondToken,
    });

    expect(first.ok && first.status).toBe('recovery-started');
    expect(second.ok && second.status).toBe('recovery-started');
    expect(third.ok && third.status).toBe('retry-exhausted');

    // exhausted 後の request は recovery-exhausted ではなくサーバー確認へ回る
    expect(db.get('firstGrade', 'r1')?.status).toBe('failed');
  });

  it('旧version の報告では状態を変えず stale-refreshed を返す', async () => {
    const db = new FakeDB();
    seedReady(db);
    const { manager } = createManager(db);

    const result = await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'oldVersion',
    });

    expect(result).toEqual({ ok: true, status: 'stale-refreshed' });
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
    // 現在ファイルが使えるので ready を再送する
    expect(
      mocks.send.mock.calls.some((call) => call[0] === AssetChannels.ready),
    ).toBe(true);
  });

  it('現在tokenのload成功だけ confirmed=true になる', async () => {
    const db = new FakeDB();
    seedReady(db);
    const { manager } = createManager(db);

    await manager.reportLoadFailure({
      grade: 'firstGrade',
      key: 'r1',
      version: 'md5AAA',
    });
    await flush();
    const token = mocks.send.mock.calls
      .filter((call) => call[0] === AssetChannels.ready)
      .at(-1)?.[1].recoveryToken as string;

    await expect(
      manager.reportLoadSuccess({
        grade: 'firstGrade',
        key: 'r1',
        version: 'md5AAA',
        recoveryToken: token,
      }),
    ).resolves.toEqual({ ok: true, confirmed: true });

    await expect(
      manager.reportLoadSuccess({
        grade: 'firstGrade',
        key: 'r1',
        version: 'md5AAA',
        recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).resolves.toEqual({ ok: true, confirmed: false });
  });

  it('token なしの成功報告と不正な報告は受け付けない', async () => {
    const db = new FakeDB();
    seedReady(db);
    const { manager } = createManager(db);

    await expect(
      manager.reportLoadSuccess({
        grade: 'firstGrade',
        key: 'r1',
        version: 'md5AAA',
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid load report' });

    await expect(
      manager.reportLoadFailure({
        grade: 'firstGrade',
        key: '../etc',
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid load report' });
  });
});

describe('clearCache', () => {
  it('clearCache 中に完了した旧workerがファイル・DB・readyを復活させない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'c1', deleted: 0 });

    const gate = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await gate.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    const { manager } = createManager(db);
    await manager.request([{ grade: 'firstGrade', key: 'c1' }]);
    await flush(2);

    const clearing = manager.clearCache();
    // 削除対象の検証（await）を通過し、取消処理が走ってから旧workerを完了させる
    await flush(1);
    gate.resolve();
    await clearing;
    await flush();

    expect(mocks.clearCache).toHaveBeenCalledTimes(1);
    expect(db.get('firstGrade', 'c1')?.local_file_path).toBeFalsy();
    expect(
      mocks.send.mock.calls.some((call) => call[0] === AssetChannels.ready),
    ).toBe(false);
  });

  it('clearCache は deleted 値を変更しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'keepDeleted', deleted: 1 });
    db.seed({ grade: 'firstGrade', key: 'keepNull', deleted: null });

    const { manager } = createManager(db);
    await manager.clearCache();

    expect(db.get('firstGrade', 'keepDeleted')?.deleted).toBe(1);
    expect(db.get('firstGrade', 'keepNull')?.deleted).toBeNull();
  });
});

describe('変更通知の反映', () => {
  it('deleted 通知で世代を進め、ローカルファイルを消して deleted=1 にする', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'n1',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/n1.png',
      updated_at_ms: 100,
    });

    const { manager } = createManager(db);
    await manager.handleChangeNotices([
      {
        grade: 'firstGrade',
        key: 'n1',
        deleted: true,
        updatedAtMs: 200,
      },
    ]);

    const row = db.get('firstGrade', 'n1');
    expect(row?.deleted).toBe(1);
    expect(row?.local_file_path).toBeNull();
    expect(row?.updated_at_ms).toBe(200);
  });

  it('既存行より古い deleted 通知は反映しない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'n2', deleted: 0, updated_at_ms: 500 });

    const { manager } = createManager(db);
    await manager.handleChangeNotices([
      { grade: 'firstGrade', key: 'n2', deleted: true, updatedAtMs: 100 },
    ]);

    expect(db.get('firstGrade', 'n2')?.deleted).toBe(0);
  });

  it('deleted=1 の行への active 通知はサーバー確認後だけ 0 へ戻す', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'n3', deleted: 1 });

    const { manager, deps } = createManager(db);
    await manager.handleChangeNotices([
      {
        grade: 'firstGrade',
        key: 'n3',
        deleted: false,
        updatedAtMs: 900,
        md5Hash: 'md5BBB',
      },
    ]);
    await flush();

    expect(deps.resolveMetaFromServer).toHaveBeenCalledTimes(1);
    expect(db.get('firstGrade', 'n3')?.deleted).toBe(0);
  });

  it('比較可能なversionがない active 通知は deleted=0 の既存内容を上書きしない', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'n4',
      deleted: 0,
      md5_hash: 'md5AAA',
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/n4.png',
    });

    const { manager } = createManager(db);
    await manager.handleChangeNotices([
      { grade: 'firstGrade', key: 'n4', deleted: false, updatedAtMs: null },
    ]);

    expect(db.get('firstGrade', 'n4')?.md5_hash).toBe('md5AAA');
    expect(db.get('firstGrade', 'n4')?.local_file_path).toBe(
      '/tmp/assets/firstGrade/n4.png',
    );
  });

  it('1件の通知処理が失敗しても後続の通知を処理できる', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'bad', deleted: 0, updated_at_ms: 1 });
    db.seed({ grade: 'firstGrade', key: 'good', deleted: 0, updated_at_ms: 1 });

    const originalMarkDeleted = db.markDeleted.bind(db);
    let firstCall = true;
    db.markDeleted = (grade: string, key: string, updatedAtMs?: number) => {
      if (firstCall) {
        firstCall = false;
        throw new Error('db failure');
      }
      originalMarkDeleted(grade, key, updatedAtMs);
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { manager } = createManager(db);
    await manager.handleChangeNotices([
      { grade: 'firstGrade', key: 'bad', deleted: true, updatedAtMs: 2 },
      { grade: 'firstGrade', key: 'good', deleted: true, updatedAtMs: 2 },
    ]);

    expect(db.get('firstGrade', 'good')?.deleted).toBe(1);
  });
});

describe('削除フロー', () => {
  it('Firestore論理削除の確定後に物理deleteを呼ばず deleted=1 にする', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'd1',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/d1.png',
      object_path: 'original/firstGrade/d1.png',
    });
    const physicalDelete = vi.spyOn(db, 'delete');
    mocks.deleteObject.mockResolvedValue(undefined);

    const { manager, deps } = createManager(db);
    await manager.deleteAsset({ grade: 'firstGrade', key: 'd1' });

    expect(deps.deleteFirestoreAssetDoc).toHaveBeenCalledWith(
      'storageList/firstGrade/images/d1',
    );
    expect(physicalDelete).not.toHaveBeenCalled();
    const row = db.get('firstGrade', 'd1');
    expect(row?.deleted).toBe(1);
    expect(row?.local_file_path).toBeNull();
    // メタ情報は保持する
    expect(row?.object_path).toBe('original/firstGrade/d1.png');
  });

  it('Firestore削除が失敗した場合はローカル状態を変更しない', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'd2',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/d2.png',
    });

    const { manager } = createManager(db, {
      deleteFirestoreAssetDoc: vi.fn(async () => {
        throw new Error('firestore failed');
      }),
    });

    await expect(
      manager.deleteAsset({ grade: 'firstGrade', key: 'd2' }),
    ).rejects.toThrow('firestore failed');

    const row = db.get('firstGrade', 'd2');
    expect(row?.deleted).toBe(0);
    expect(row?.local_file_path).toBe('/tmp/assets/firstGrade/d2.png');
  });

  it('Storage削除が失敗しても論理削除は巻き戻さない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'd3', deleted: 0 });
    mocks.deleteObject.mockRejectedValue(new Error('storage down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { manager } = createManager(db);
    await expect(
      manager.deleteAsset({ grade: 'firstGrade', key: 'd3' }),
    ).rejects.toThrow('storage down');

    expect(db.get('firstGrade', 'd3')?.deleted).toBe(1);
  });
});

describe('dispose', () => {
  it('購読解除とDB closeを行い、待機requestを完了する', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'z', deleted: null });
    const close = vi.spyOn(db, 'close');
    const unsubscribe = vi.fn();

    const gate = deferred<void>();
    const { manager } = createManager(db, {
      resolveMetaFromServer: vi.fn(async () => {
        await gate.promise;
        return activeMeta('firstGrade', 'z', 'md5AAA');
      }),
    });
    manager.registerChangeSubscription(unsubscribe);

    const pending = manager.request([{ grade: 'firstGrade', key: 'z' }]);
    await flush(2);
    manager.dispose();
    gate.resolve();

    const result = await pending;
    expect(result.failed[0].reason).toBe('asset-state-unavailable');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('例外状態でないrequestはサーバー確認へ回さない（設計4.6）', () => {
  it('AssetDBに行が無い画像は confirm-meta ではなく download へ進む', async () => {
    const db = new FakeDB();
    const { manager, deps } = createManager(db);

    const result = await manager.request([
      { grade: 'firstGrade', key: 'brandNew' },
    ]);
    await flush();

    expect(deps.resolveMetaFromServer).not.toHaveBeenCalled();
    expect(deps.resolveMeta).toHaveBeenCalledTimes(1);
    expect(result.pending).toEqual([{ grade: 'firstGrade', key: 'brandNew' }]);
  });

  it('deleted=0 の未取得行も download へ進む', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'known', deleted: 0 });
    const { manager, deps } = createManager(db);

    await manager.request([{ grade: 'firstGrade', key: 'known' }]);
    await flush();

    expect(deps.resolveMetaFromServer).not.toHaveBeenCalled();
    expect(deps.resolveMeta).toHaveBeenCalledTimes(1);
  });

  it('行が無い画像への active 通知では取得も確認もしない', async () => {
    const db = new FakeDB();
    const { manager, deps } = createManager(db);

    await manager.handleChangeNotices([
      {
        grade: 'firstGrade',
        key: 'remoteOnly',
        deleted: false,
        updatedAtMs: 100,
        md5Hash: 'md5CCC',
      },
    ]);
    await flush();

    expect(deps.resolveMetaFromServer).not.toHaveBeenCalled();
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
    expect(db.get('firstGrade', 'remoteOnly')).toBeUndefined();
  });

  it('行が無い画像への deleted 通知では削除済み行を作る', async () => {
    const db = new FakeDB();
    const { manager } = createManager(db);

    await manager.handleChangeNotices([
      {
        grade: 'firstGrade',
        key: 'remoteDeleted',
        deleted: true,
        updatedAtMs: 100,
      },
    ]);

    expect(db.get('firstGrade', 'remoteDeleted')?.deleted).toBe(1);
  });

  it('protocol は行が無い画像に404を返しつつ取得を登録する', async () => {
    const db = new FakeDB();
    const { manager } = createManager(db);

    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'fresh' }),
    ).resolves.toEqual({ kind: 'not-found' });

    await flush();
    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
  });
});

describe('不正な grade / key への防御（設計8章）', () => {
  it('削除対象の検証に失敗した場合は状態もDBも変更せずエラーにする', async () => {
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'keep',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/keep.png',
    });
    const { manager } = createManager(db);

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.verifyClearTarget.mockResolvedValue({ ok: false, reason: 'symlink' });

    await expect(manager.clearCache({ grade: 'firstGrade' })).rejects.toThrow(
      /clear target verification failed/,
    );

    // AssetDB のローカル情報を消さない
    expect(db.get('firstGrade', 'keep')?.local_file_path).toBe(
      '/tmp/assets/firstGrade/keep.png',
    );
    expect(db.get('firstGrade', 'keep')?.status).toBe('ready');
    // Chromium cache のクリアまで進めない
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });

  it('request は不正な key を処理せず asset-state-unavailable を返す', async () => {
    const db = new FakeDB();
    const { manager, deps } = createManager(db);

    const result = await manager.request([
      { grade: 'firstGrade', key: '../etc' } as never,
    ]);

    expect(result.failed[0].reason).toBe('asset-state-unavailable');
    expect(deps.resolveMeta).not.toHaveBeenCalled();
    expect(deps.resolveMetaFromServer).not.toHaveBeenCalled();
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
  });
});

describe('Firestoreメタが取れない場合の download（設計4.7）', () => {
  it('not-found では Storage へ進まず asset-not-found で終了する', async () => {
    const db = new FakeDB();
    // 古い AssetDB 行が残っていても再取得しない
    db.seed({
      grade: 'firstGrade',
      key: 'stale',
      deleted: 0,
      object_path: 'original/firstGrade/stale.png',
      md5_hash: 'md5OLD',
    });

    const { manager } = createManager(db, {
      resolveMeta: vi.fn(async () => ({ kind: 'not-found' as const })),
    });

    await manager.request([{ grade: 'firstGrade', key: 'stale' }]);
    await flush(10);

    // 署名URL取得にもStorage取得にも進まない
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
    // downloading への遷移も行わない（メタ確定前に状態を進めない）
    expect(db.get('firstGrade', 'stale')?.status).toBeUndefined();
    // deleted の確定は server-only 確認の責務なので変更しない
    expect(db.get('firstGrade', 'stale')?.deleted).toBe(0);
    // 既存メタは残す
    expect(db.get('firstGrade', 'stale')?.md5_hash).toBe('md5OLD');
  });

  it('found-active なら従来どおり download へ進む', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'active', deleted: 0 });

    const { manager } = createManager(db);
    await manager.request([{ grade: 'firstGrade', key: 'active' }]);
    await flush(10);

    expect(mocks.downloadWithVerify).toHaveBeenCalledTimes(1);
  });
});

describe('再試行中の request 完了タイミング（設計4.3）', () => {
  it('再試行可能な中間失敗では request を完了せず、再試行の結果で応答する', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'slow', deleted: null });

    const firstFailure = deferred<void>();
    let calls = 0;
    const resolveMetaFromServer = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        // 初回失敗が遅延するケースを再現する
        await firstFailure.promise;
        return { kind: 'unavailable' as const, error: new Error('offline') };
      }
      return activeMeta('firstGrade', 'slow', 'md5AAA');
    });

    const { manager } = createManager(db, { resolveMetaFromServer });

    let settled = false;
    const pending = manager
      .request([{ grade: 'firstGrade', key: 'slow' }])
      .then((res) => {
        settled = true;
        return res;
      });

    await flush(3);
    // 1回目の失敗前に応答してはいけない
    expect(settled).toBe(false);

    // 失敗を解放すると再試行が走り、その結果で初めて応答する
    firstFailure.resolve();

    const result = await pending;
    expect(settled).toBe(true);
    expect(calls).toBe(2);
    expect(result.failed).toEqual([]);
    // 確認後に download が必要なので pending として完了する
    expect(result.pending).toEqual([{ grade: 'firstGrade', key: 'slow' }]);
  });

  it('再試行上限に達したら失敗として完了する', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'dead', deleted: null });

    const resolveMetaFromServer = vi.fn(async () => ({
      kind: 'unavailable' as const,
      error: new Error('offline'),
    }));
    const { manager } = createManager(db, { resolveMetaFromServer });

    const result = await manager.request([
      { grade: 'firstGrade', key: 'dead' },
    ]);

    expect(resolveMetaFromServer).toHaveBeenCalledTimes(3);
    expect(result.failed[0].reason).toBe('asset-state-unavailable');
  });
});

describe('学年指定 clearCache の影響範囲（設計7.2）', () => {
  it('対象外の学年で実行中の download は失効せず ready 通知が出る', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'secondGrade', key: 'other', deleted: 0 });

    const gate = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await gate.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    const { manager } = createManager(db);
    await manager.request([{ grade: 'secondGrade', key: 'other' }]);
    await flush(2);

    // 1級だけをクリアする
    await manager.clearCache({ grade: 'firstGrade' });

    gate.resolve();
    await flush();

    const readySends = mocks.send.mock.calls.filter(
      (call) => call[0] === AssetChannels.ready,
    );
    expect(readySends).toHaveLength(1);
    expect(readySends[0][1]).toMatchObject({
      grade: 'secondGrade',
      key: 'other',
    });
    expect(db.get('secondGrade', 'other')?.status).toBe('ready');
  });

  it('対象外の学年で待機中の request は失敗にならない', async () => {
    const db = new FakeDB();
    db.seed({ grade: 'firstGrade', key: 'blocking', deleted: 0 });
    db.seed({ grade: 'secondGrade', key: 'waiting', deleted: null });

    const blocking = deferred<void>();
    mocks.downloadWithVerify.mockImplementation(async () => {
      await blocking.promise;
      return { bytes: 10, md5Base64: 'md5AAA' };
    });

    const { manager } = createManager(db);
    // 1件目で worker を占有し、2件目を待機させる
    await manager.request([{ grade: 'firstGrade', key: 'blocking' }]);
    const waiting = manager.request([{ grade: 'secondGrade', key: 'waiting' }]);
    await flush(2);

    await manager.clearCache({ grade: 'firstGrade' });
    blocking.resolve();

    const result = await waiting;
    expect(result.failed).toEqual([]);
    expect(result.pending).toEqual([{ grade: 'secondGrade', key: 'waiting' }]);
  });
});

describe('stat-failed の扱い（再レビュー指摘4）', () => {
  const seedReadyRow = (db: FakeDB) =>
    db.seed({
      grade: 'firstGrade',
      key: 'locked',
      deleted: 0,
      status: 'ready',
      local_file_path: '/tmp/assets/firstGrade/locked.png',
      md5_hash: 'md5AAA',
    });

  it('request では DB を消さず、ダウンロードもせず unavailable を返す', async () => {
    const db = new FakeDB();
    seedReadyRow(db);
    mocks.verifyAssetFile.mockResolvedValue({
      ok: false,
      reason: 'stat-failed',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { manager } = createManager(db);
    const result = await manager.request([
      { grade: 'firstGrade', key: 'locked' },
    ]);
    await flush(3);

    expect(result.failed[0].reason).toBe('asset-state-unavailable');
    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
    // 有効なキャッシュ情報を破棄しない
    expect(db.get('firstGrade', 'locked')?.local_file_path).toBe(
      '/tmp/assets/firstGrade/locked.png',
    );
    expect(db.get('firstGrade', 'locked')?.status).toBe('ready');
  });

  it('protocol では配信もダウンロード登録もせず、DB を消さない', async () => {
    const db = new FakeDB();
    seedReadyRow(db);
    mocks.verifyAssetFile.mockResolvedValue({
      ok: false,
      reason: 'stat-failed',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { manager } = createManager(db);
    await expect(
      manager.resolveProtocolRequest({ grade: 'firstGrade', key: 'locked' }),
    ).resolves.toEqual({ kind: 'not-found' });
    await flush(3);

    expect(mocks.downloadWithVerify).not.toHaveBeenCalled();
    expect(db.get('firstGrade', 'locked')?.local_file_path).toBe(
      '/tmp/assets/firstGrade/locked.png',
    );
  });
});

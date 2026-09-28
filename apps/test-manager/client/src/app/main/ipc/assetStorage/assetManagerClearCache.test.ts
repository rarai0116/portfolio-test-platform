/** biome-ignore-all lint/suspicious/noExplicitAny: テスト用モックのため */
import fsNode from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * clearCache のファイル削除を、実ファイルシステム上で
 * 実際の AssetManager.removeLocalFiles() を通して検証する。
 * localAsset はモックしない（検証ロジックそのものを対象にするため）。
 */

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getAllWindows: vi.fn(),
  httpsCallable: vi.fn(),
  downloadWithVerify: vi.fn(),
  sessionClearCache: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  BrowserWindow: { getAllWindows: mocks.getAllWindows },
  session: { defaultSession: { clearCache: mocks.sessionClearCache } },
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

vi.mock('./downloader', () => ({
  downloadWithVerify: mocks.downloadWithVerify,
}));

vi.mock('@main/services/firebase', () => ({
  ensureAuthClaims: vi.fn(),
  firestore: {},
  functions: {},
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getMetadata: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: mocks.httpsCallable,
}));

import { AssetManager } from './assetManager';
import type { AssetDB, AssetRow } from './db';

class FakeDB {
  rows = new Map<string, AssetRow>();
  clearAllLocalCalls = 0;

  seed(row: Partial<AssetRow> & { grade: string; key: string }) {
    this.rows.set(`${row.grade}/${row.key}`, row as AssetRow);
  }

  get(grade: string, key: string) {
    return this.rows.get(`${grade}/${key}`);
  }

  clearAllLocal(grade?: string) {
    this.clearAllLocalCalls += 1;
    for (const row of this.rows.values()) {
      if (grade && row.grade !== grade) continue;
      row.local_file_path = null;
      row.status = null;
    }
    return this.rows.size;
  }

  upsertMeta() {}
  setStatus() {}
  setLocalPath() {}
  touchAccess() {}
  markDeleted() {}
  markActive() {}
  clearLocalCacheEntry() {
    return 1;
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

let userData = '';
let assetsRoot = '';
let outsideDir = '';

const createManager = (db: FakeDB, root: string) =>
  new AssetManager({ root }, db as unknown as AssetDB, {
    mainWindow,
    resolveMeta: vi.fn(),
    resolveMetaFromServer: vi.fn(),
    deleteFirestoreAssetDoc: vi.fn(),
  });

const makeJunction = async (linkPath: string, target: string) => {
  try {
    await fs.symlink(target, linkPath, 'junction');
    return true;
  } catch {
    return false;
  }
};

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.getAllWindows.mockReturnValue([mainWindow]);
  mocks.httpsCallable.mockReturnValue(vi.fn());
  mocks.sessionClearCache.mockResolvedValue(undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-clearcache-'));
  assetsRoot = path.join(userData, 'assets');
  outsideDir = path.join(userData, 'outside-store');
  await fs.mkdir(path.join(assetsRoot, 'firstGrade'), { recursive: true });
  await fs.mkdir(path.join(outsideDir, 'nested'), { recursive: true });
  await fs.writeFile(path.join(outsideDir, 'important.txt'), 'DO-NOT-DELETE');
  await fs.writeFile(
    path.join(outsideDir, 'nested', 'deep.txt'),
    'DO-NOT-DELETE',
  );
});

afterEach(async () => {
  await fs.rm(userData, { recursive: true, force: true });
});

describe('clearCache のファイル削除（実FS）', () => {
  it('通常状態ではアセットファイルを削除し、DBとChromium cacheもクリアする', async () => {
    const filePath = path.join(assetsRoot, 'firstGrade', 'key1.png');
    await fs.writeFile(filePath, 'PNG');
    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'key1',
      deleted: 0,
      status: 'ready',
      local_file_path: filePath,
    });

    const manager = createManager(db, assetsRoot);
    const result = await manager.clearCache();

    expect(result.removedFiles).toBe(1);
    expect(fsNode.existsSync(filePath)).toBe(false);
    expect(db.get('firstGrade', 'key1')?.local_file_path).toBeNull();
    expect(mocks.sessionClearCache).toHaveBeenCalledTimes(1);
  });

  it('学年指定では対象学年だけを削除する', async () => {
    await fs.mkdir(path.join(assetsRoot, 'secondGrade'), { recursive: true });
    const firstFile = path.join(assetsRoot, 'firstGrade', 'a.png');
    const secondFile = path.join(assetsRoot, 'secondGrade', 'b.png');
    await fs.writeFile(firstFile, 'PNG');
    await fs.writeFile(secondFile, 'PNG');

    const manager = createManager(new FakeDB(), assetsRoot);
    await manager.clearCache({ grade: 'firstGrade' });

    expect(fsNode.existsSync(firstFile)).toBe(false);
    expect(fsNode.existsSync(secondFile)).toBe(true);
  });

  it('学年ディレクトリが junction ならリンク先を消さずエラーにする', async () => {
    await fs.rm(path.join(assetsRoot, 'firstGrade'), {
      recursive: true,
      force: true,
    });
    if (
      !(await makeJunction(path.join(assetsRoot, 'firstGrade'), outsideDir))
    ) {
      return;
    }

    const db = new FakeDB();
    db.seed({
      grade: 'firstGrade',
      key: 'key1',
      deleted: 0,
      status: 'ready',
      local_file_path: path.join(assetsRoot, 'firstGrade', 'key1.png'),
    });
    const manager = createManager(db, assetsRoot);

    await expect(manager.clearCache({ grade: 'firstGrade' })).rejects.toThrow(
      /clear target verification failed/,
    );

    // リンク先の目印ファイルが残る
    await expect(
      fs.readFile(path.join(outsideDir, 'important.txt'), 'utf8'),
    ).resolves.toBe('DO-NOT-DELETE');
    await expect(
      fs.readFile(path.join(outsideDir, 'nested', 'deep.txt'), 'utf8'),
    ).resolves.toBe('DO-NOT-DELETE');
    // DB も Chromium cache も変更しない
    expect(db.clearAllLocalCalls).toBe(0);
    expect(db.get('firstGrade', 'key1')?.local_file_path).not.toBeNull();
    expect(mocks.sessionClearCache).not.toHaveBeenCalled();
  });

  it('アセットルートが junction ならリンク先を消さずエラーにする', async () => {
    const linkedRoot = path.join(userData, 'linked-assets');
    if (!(await makeJunction(linkedRoot, outsideDir))) return;

    const db = new FakeDB();
    const manager = createManager(db, linkedRoot);

    await expect(manager.clearCache()).rejects.toThrow(
      /clear target verification failed/,
    );

    await expect(
      fs.readFile(path.join(outsideDir, 'important.txt'), 'utf8'),
    ).resolves.toBe('DO-NOT-DELETE');
    expect(db.clearAllLocalCalls).toBe(0);
    expect(mocks.sessionClearCache).not.toHaveBeenCalled();
  });

  it('ルートが junction で対象学年が存在しない場合も拒否する', async () => {
    const linkedRoot = path.join(userData, 'linked-assets');
    if (!(await makeJunction(linkedRoot, outsideDir))) return;

    const manager = createManager(new FakeDB(), linkedRoot);

    // リンク先に firstGrade は無い。ルートの junction を先に検出する必要がある
    await expect(manager.clearCache({ grade: 'firstGrade' })).rejects.toThrow(
      /clear target verification failed/,
    );
    expect(mocks.sessionClearCache).not.toHaveBeenCalled();
  });

  it('配下の junction は辿らず、リンク自体だけを削除する', async () => {
    const nestedJunction = path.join(assetsRoot, 'firstGrade', 'linked');
    if (!(await makeJunction(nestedJunction, outsideDir))) return;

    const manager = createManager(new FakeDB(), assetsRoot);
    await manager.clearCache();

    await expect(
      fs.readFile(path.join(outsideDir, 'important.txt'), 'utf8'),
    ).resolves.toBe('DO-NOT-DELETE');
    expect(fsNode.existsSync(nestedJunction)).toBe(false);
  });

  it('走査中に対象が差し替えられた場合は削除を中止する', async () => {
    // 事前検証は通り、removeLocalFiles の再検証で止まる経路を直接確認する
    // （検証と削除の間の差し替えは公開APIから決定的に再現できないため白箱で確認する）
    const gradeDir = path.join(assetsRoot, 'firstGrade');
    await fs.rm(gradeDir, { recursive: true, force: true });
    if (!(await makeJunction(gradeDir, outsideDir))) return;

    const manager = createManager(new FakeDB(), assetsRoot);

    await expect(
      (
        manager as unknown as {
          removeLocalFiles: (target: string) => Promise<number>;
        }
      ).removeLocalFiles(gradeDir),
    ).rejects.toThrow(/verification failed during removal/);

    await expect(
      fs.readFile(path.join(outsideDir, 'important.txt'), 'utf8'),
    ).resolves.toBe('DO-NOT-DELETE');
  });
});

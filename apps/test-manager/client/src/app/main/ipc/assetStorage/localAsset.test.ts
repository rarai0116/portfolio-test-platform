import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StartupError } from '@main/startup/fatalStartup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildAssetFilePath,
  ensureGradeDirectory,
  initializeAssetRoot,
  resolveAssetVersion,
  toUrlSafeVersion,
  verifyAssetFile,
  verifyClearTarget,
  verifyDirectoryForRemoval,
} from './localAsset';

let userData = '';

beforeEach(async () => {
  userData = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-asset-local-'));
});

afterEach(async () => {
  await fs.rm(userData, { recursive: true, force: true });
});

describe('initializeAssetRoot', () => {
  it('userData配下に assets を作成して実体パスを返す', async () => {
    const { root } = await initializeAssetRoot(userData);
    const stat = await fs.stat(root);
    expect(stat.isDirectory()).toBe(true);
    expect(path.basename(root)).toBe('assets');
  });

  it('再実行しても既存ディレクトリを壊さない', async () => {
    const first = await initializeAssetRoot(userData);
    await fs.writeFile(path.join(first.root, 'keep.txt'), 'x');
    const second = await initializeAssetRoot(userData);
    expect(second.root).toBe(first.root);
    await expect(
      fs.readFile(path.join(second.root, 'keep.txt'), 'utf8'),
    ).resolves.toBe('x');
  });

  it('assets が symlink の場合は asset-root-trust-check で失敗する', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-asset-out-'));
    try {
      await fs.symlink(outside, path.join(userData, 'assets'), 'junction');
    } catch {
      // 権限等でsymlinkが作れない環境ではこのケースを検証しない
      await fs.rm(outside, { recursive: true, force: true });
      return;
    }

    const error = await initializeAssetRoot(userData).catch((e) => e);
    expect(error).toBeInstanceOf(StartupError);
    expect((error as StartupError).phase).toBe('asset-root-trust-check');
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('userData が存在しない場合は asset-root-realpath で失敗する', async () => {
    const error = await initializeAssetRoot(
      path.join(userData, 'missing-dir'),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(StartupError);
    expect((error as StartupError).phase).toBe('asset-root-realpath');
  });
});

describe('verifyAssetFile', () => {
  const write = async (root: string, grade: string, key: string) => {
    const filePath = buildAssetFilePath(root, grade, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'png-bytes');
    return filePath;
  };

  it('ルート内の通常ファイルを許可する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const filePath = await write(root, 'firstGrade', 'key1');

    const result = await verifyAssetFile({
      root,
      grade: 'firstGrade',
      key: 'key1',
      filePath,
    });
    expect(result).toEqual({ ok: true, size: 'png-bytes'.length });
  });

  it('存在しないファイルは missing になる', async () => {
    const { root } = await initializeAssetRoot(userData);
    const result = await verifyAssetFile({
      root,
      grade: 'firstGrade',
      key: 'key1',
      filePath: buildAssetFilePath(root, 'firstGrade', 'key1'),
    });
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('grade/key と一致しない実体パスは path-mismatch になる', async () => {
    const { root } = await initializeAssetRoot(userData);
    const filePath = await write(root, 'firstGrade', 'other');

    const result = await verifyAssetFile({
      root,
      grade: 'firstGrade',
      key: 'key1',
      filePath,
    });
    expect(result).toEqual({ ok: false, reason: 'path-mismatch' });
  });

  it('ファイルsymlinkは、リンク先がルート内でも拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const target = await write(root, 'firstGrade', 'target');
    const linkPath = buildAssetFilePath(root, 'firstGrade', 'linked');
    try {
      await fs.symlink(target, linkPath, 'file');
    } catch {
      // symlinkを作れない環境ではこのケースを検証しない
      return;
    }

    await expect(
      verifyAssetFile({
        root,
        grade: 'firstGrade',
        key: 'linked',
        filePath: linkPath,
      }),
    ).resolves.toEqual({ ok: false, reason: 'symlink' });
  });

  it('ルート外を指すファイルsymlinkを拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outsideFile = path.join(userData, 'outside.png');
    await fs.writeFile(outsideFile, 'outside');
    const linkPath = buildAssetFilePath(root, 'firstGrade', 'outsideLink');
    await fs.mkdir(path.dirname(linkPath), { recursive: true });
    try {
      await fs.symlink(outsideFile, linkPath, 'file');
    } catch {
      return;
    }

    await expect(
      verifyAssetFile({
        root,
        grade: 'firstGrade',
        key: 'outsideLink',
        filePath: linkPath,
      }),
    ).resolves.toEqual({ ok: false, reason: 'symlink' });
  });

  it('学年ディレクトリがjunctionの場合は配下のファイルを拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outsideDir = path.join(userData, 'outsideGrade');
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(path.join(outsideDir, 'k.png'), 'outside');

    const junctionGrade = path.join(root, 'secondGrade');
    try {
      await fs.symlink(outsideDir, junctionGrade, 'junction');
    } catch {
      return;
    }

    // ファイル自身の lstat は通常ファイルに見えるが、realpath 比較で検出できる
    await expect(
      verifyAssetFile({
        root,
        grade: 'secondGrade',
        key: 'k',
        filePath: path.join(junctionGrade, 'k.png'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'symlink' });
  });

  it('local_file_path が正規パスと異なる場合は path-mismatch になる', async () => {
    const { root } = await initializeAssetRoot(userData);
    await write(root, 'firstGrade', 'key1');

    await expect(
      verifyAssetFile({
        root,
        grade: 'firstGrade',
        key: 'key1',
        filePath: path.join(userData, 'elsewhere', 'key1.png'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'path-mismatch' });
  });

  it('ディレクトリは not-regular-file になる', async () => {
    const { root } = await initializeAssetRoot(userData);
    const dirPath = buildAssetFilePath(root, 'firstGrade', 'dirkey');
    await fs.mkdir(dirPath, { recursive: true });

    const result = await verifyAssetFile({
      root,
      grade: 'firstGrade',
      key: 'dirkey',
      filePath: dirPath,
    });
    expect(result).toEqual({ ok: false, reason: 'not-regular-file' });
  });
});

describe('version の決定', () => {
  it('base64のMD5をbase64urlへ正規化する', () => {
    expect(toUrlSafeVersion('ab+/cd==')).toBe('ab-_cd');
  });

  it('md5_hash を優先し、無ければ updated_at_ms を使う', () => {
    expect(
      resolveAssetVersion({ md5_hash: 'ab+/cd==', updated_at_ms: 1700 }),
    ).toBe('ab-_cd');
    expect(resolveAssetVersion({ md5_hash: null, updated_at_ms: 1700 })).toBe(
      '1700',
    );
    expect(
      resolveAssetVersion({ md5_hash: null, updated_at_ms: null }),
    ).toBeUndefined();
    expect(resolveAssetVersion(undefined)).toBeUndefined();
  });

  it('URL規則を満たせない値は version なしとして扱う', () => {
    expect(
      resolveAssetVersion({ md5_hash: 'has space', updated_at_ms: null }),
    ).toBeUndefined();
  });
});

describe('ensureGradeDirectory（設計8.1）', () => {
  it('学年ディレクトリを作成し、通常ディレクトリなら許可する', async () => {
    const { root } = await initializeAssetRoot(userData);

    const result = await ensureGradeDirectory(root, 'firstGrade');

    expect(result).toEqual({
      ok: true,
      path: path.join(root, 'firstGrade'),
    });
    const stat = await fs.lstat(path.join(root, 'firstGrade'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('学年ディレクトリが junction の場合は拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outsideDir = path.join(userData, 'outsideGrade');
    await fs.mkdir(outsideDir, { recursive: true });
    try {
      await fs.symlink(outsideDir, path.join(root, 'firstGrade'), 'junction');
    } catch {
      return;
    }

    const result = await ensureGradeDirectory(root, 'firstGrade');
    expect(result).toEqual({ ok: false, reason: 'symlink' });
  });

  it('ルート直下にならない grade は拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);

    const result = await ensureGradeDirectory(root, '../outside');
    expect(result).toEqual({ ok: false, reason: 'path-mismatch' });
  });
});

describe('verifyClearTarget（設計8.1 / 8.2）', () => {
  it('通常のアセットルートと学年ディレクトリを許可する', async () => {
    const { root } = await initializeAssetRoot(userData);
    await fs.mkdir(path.join(root, 'firstGrade'), { recursive: true });

    await expect(verifyClearTarget(root)).resolves.toEqual({
      ok: true,
      path: path.resolve(root),
      exists: true,
    });
    await expect(verifyClearTarget(root, 'firstGrade')).resolves.toEqual({
      ok: true,
      path: path.join(path.resolve(root), 'firstGrade'),
      exists: true,
    });
  });

  it('対象が存在しない場合は exists=false で許可する', async () => {
    const { root } = await initializeAssetRoot(userData);

    await expect(verifyClearTarget(root, 'secondGrade')).resolves.toEqual({
      ok: true,
      path: path.join(path.resolve(root), 'secondGrade'),
      exists: false,
    });
  });

  it('学年ディレクトリが junction の場合は拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outside = path.join(userData, 'outside-store');
    await fs.mkdir(outside, { recursive: true });
    try {
      await fs.symlink(outside, path.join(root, 'firstGrade'), 'junction');
    } catch {
      return;
    }

    await expect(verifyClearTarget(root, 'firstGrade')).resolves.toEqual({
      ok: false,
      reason: 'symlink',
    });
  });

  it('アセットルート自体が junction の場合は拒否する', async () => {
    const outside = path.join(userData, 'outside-root');
    await fs.mkdir(outside, { recursive: true });
    const fakeRoot = path.join(userData, 'linked-assets');
    try {
      await fs.symlink(outside, fakeRoot, 'junction');
    } catch {
      return;
    }

    await expect(verifyClearTarget(fakeRoot)).resolves.toEqual({
      ok: false,
      reason: 'symlink',
    });
    // 学年指定でも、経路上のリンクを realpath 比較で検出する
    await fs.mkdir(path.join(outside, 'firstGrade'), { recursive: true });
    await expect(verifyClearTarget(fakeRoot, 'firstGrade')).resolves.toEqual({
      ok: false,
      reason: 'symlink',
    });
  });

  it('ルート直下にならない grade を拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);

    await expect(verifyClearTarget(root, '../..')).resolves.toEqual({
      ok: false,
      reason: 'path-mismatch',
    });
  });

  it('ディレクトリでない対象を拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    await fs.writeFile(path.join(root, 'firstGrade'), 'not a directory');

    await expect(verifyClearTarget(root, 'firstGrade')).resolves.toEqual({
      ok: false,
      reason: 'not-directory',
    });
  });
});

describe('clearCache が junction のリンク先を削除しない（指摘1の回帰）', () => {
  /** assetManager.removeLocalFiles と同じ再帰削除 */
  const removeDirSafe = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        await fs.unlink(full).catch(() => fs.rmdir(full).catch(() => {}));
        continue;
      }
      if (entry.isDirectory()) {
        await removeDirSafe(full);
      } else {
        await fs.unlink(full).catch(() => {});
      }
    }
    await fs.rmdir(dir).catch(() => {});
  };

  it('学年 junction では検証が拒否し、リンク先の目印ファイルが残る', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outside = path.join(userData, 'outside-store');
    await fs.mkdir(path.join(outside, 'nested'), { recursive: true });
    const marker = path.join(outside, 'important.txt');
    const deepMarker = path.join(outside, 'nested', 'deep.txt');
    await fs.writeFile(marker, 'DO-NOT-DELETE');
    await fs.writeFile(deepMarker, 'DEEP');

    try {
      await fs.symlink(outside, path.join(root, 'firstGrade'), 'junction');
    } catch {
      return;
    }

    const verification = await verifyClearTarget(root, 'firstGrade');
    expect(verification.ok).toBe(false);

    // 検証を通った場合だけ削除する運用を再現する
    if (verification.ok) {
      await removeDirSafe(verification.path);
    }

    await expect(fs.readFile(marker, 'utf8')).resolves.toBe('DO-NOT-DELETE');
    await expect(fs.readFile(deepMarker, 'utf8')).resolves.toBe('DEEP');
  });

  it('アセットルート junction でも同様にリンク先が残る', async () => {
    const outside = path.join(userData, 'outside-root');
    await fs.mkdir(outside, { recursive: true });
    const marker = path.join(outside, 'important.txt');
    await fs.writeFile(marker, 'DO-NOT-DELETE');

    const fakeRoot = path.join(userData, 'linked-assets');
    try {
      await fs.symlink(outside, fakeRoot, 'junction');
    } catch {
      return;
    }

    const verification = await verifyClearTarget(fakeRoot);
    expect(verification.ok).toBe(false);
    if (verification.ok) {
      await removeDirSafe(verification.path);
    }

    await expect(fs.readFile(marker, 'utf8')).resolves.toBe('DO-NOT-DELETE');
  });
});

describe('verifyClearTarget のルート先行検査（第3回レビュー指摘2）', () => {
  it('ルートが junction なら、対象学年が存在しなくても拒否する', async () => {
    const outside = path.join(userData, 'outside-root');
    await fs.mkdir(outside, { recursive: true });
    const fakeRoot = path.join(userData, 'linked-assets');
    if (
      !(await fs
        .symlink(outside, fakeRoot, 'junction')
        .then(() => true)
        .catch(() => false))
    ) {
      return;
    }

    // リンク先に firstGrade は存在しない（従来は exists:false で通過していた）
    await expect(verifyClearTarget(fakeRoot, 'firstGrade')).resolves.toEqual({
      ok: false,
      reason: 'symlink',
    });
  });

  it('ルートが存在しない場合は exists=false で許可する', async () => {
    const missingRoot = path.join(userData, 'missing-assets');

    await expect(verifyClearTarget(missingRoot)).resolves.toEqual({
      ok: true,
      path: path.resolve(missingRoot),
      exists: false,
    });
    await expect(verifyClearTarget(missingRoot, 'firstGrade')).resolves.toEqual(
      {
        ok: true,
        path: path.resolve(missingRoot),
        exists: false,
      },
    );
  });
});

describe('verifyDirectoryForRemoval', () => {
  it('ルート自身とルート配下の通常ディレクトリを許可する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const gradeDir = path.join(root, 'firstGrade');
    await fs.mkdir(gradeDir, { recursive: true });

    await expect(verifyDirectoryForRemoval(root, root)).resolves.toEqual({
      ok: true,
      exists: true,
    });
    await expect(verifyDirectoryForRemoval(gradeDir, root)).resolves.toEqual({
      ok: true,
      exists: true,
    });
  });

  it('ルート外のディレクトリを拒否する', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outside = path.join(userData, 'outside');
    await fs.mkdir(outside, { recursive: true });

    await expect(verifyDirectoryForRemoval(outside, root)).resolves.toEqual({
      ok: false,
      reason: 'path-mismatch',
    });
  });

  it('junction とファイルを拒否し、不在は exists=false とする', async () => {
    const { root } = await initializeAssetRoot(userData);
    const outside = path.join(userData, 'outside');
    await fs.mkdir(outside, { recursive: true });

    const filePath = path.join(root, 'notADir');
    await fs.writeFile(filePath, 'x');
    await expect(verifyDirectoryForRemoval(filePath, root)).resolves.toEqual({
      ok: false,
      reason: 'not-directory',
    });

    await expect(
      verifyDirectoryForRemoval(path.join(root, 'missing'), root),
    ).resolves.toEqual({ ok: true, exists: false });

    const junction = path.join(root, 'linked');
    if (
      await fs
        .symlink(outside, junction, 'junction')
        .then(() => true)
        .catch(() => false)
    ) {
      await expect(verifyDirectoryForRemoval(junction, root)).resolves.toEqual({
        ok: false,
        reason: 'symlink',
      });
    }
  });
});

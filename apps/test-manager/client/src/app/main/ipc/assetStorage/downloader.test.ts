import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gotStream: vi.fn(),
}));

vi.mock('got', () => ({
  default: { stream: mocks.gotStream },
}));

import { downloadWithVerify } from './downloader';

let workDir = '';
let assetsRoot = '';
let gradeDir = '';
let outsideDir = '';

/** got.stream の代わりに、内容を流すだけのストリームを返す */
const respondWith = (
  body: string,
  options: { beforeEnd?: () => Promise<void> | void } = {},
) => {
  mocks.gotStream.mockImplementation(() => {
    const stream = new PassThrough();
    queueMicrotask(async () => {
      stream.write(body);
      await options.beforeEnd?.();
      stream.end();
    });
    return stream;
  });
};

const makeJunction = async (linkPath: string, target: string) => {
  try {
    await fsp.symlink(target, linkPath, 'junction');
    return true;
  } catch {
    // junction を作れない環境ではこのケースを検証しない
    return false;
  }
};

beforeEach(async () => {
  vi.clearAllMocks();
  workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'demo-downloader-'));
  assetsRoot = path.join(workDir, 'assets');
  gradeDir = path.join(assetsRoot, 'firstGrade');
  outsideDir = path.join(workDir, 'outside');
  await fsp.mkdir(gradeDir, { recursive: true });
  await fsp.mkdir(outsideDir, { recursive: true });
  respondWith('PNG-BYTES');
});

afterEach(async () => {
  await fsp.rm(workDir, { recursive: true, force: true });
});

describe('downloadWithVerify', () => {
  it('通常の学年ディレクトリへは保存できる', async () => {
    const destPath = path.join(gradeDir, 'key1.png');

    const result = await downloadWithVerify({
      url: 'https://example.test/signed',
      destPath,
    });

    expect(result.bytes).toBe('PNG-BYTES'.length);
    await expect(fsp.readFile(destPath, 'utf8')).resolves.toBe('PNG-BYTES');
    // 一時ファイルは残さない
    expect(fs.existsSync(`${destPath}.downloading`)).toBe(false);
  });

  it('学年ディレクトリが junction の場合は書き込まずに失敗する（指摘2の回帰）', async () => {
    // 事前検査の後、署名URL取得を待つ間に junction へ差し替えられた状態を再現する
    await fsp.rmdir(gradeDir);
    if (!(await makeJunction(gradeDir, outsideDir))) return;

    const destPath = path.join(gradeDir, 'key1.png');

    await expect(
      downloadWithVerify({ url: 'https://example.test/signed', destPath }),
    ).rejects.toThrow(/symlink|link/i);

    // リンク先に一時ファイルも完成ファイルも作られない
    expect(fs.existsSync(path.join(outsideDir, 'key1.png.downloading'))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(outsideDir, 'key1.png'))).toBe(false);
    // ネットワーク取得へも進まない
    expect(mocks.gotStream).not.toHaveBeenCalled();
  });

  it('書き込み中に学年ディレクトリが junction へ差し替えられた場合は完成させない', async () => {
    const destPath = path.join(gradeDir, 'key1.png');

    // ストリーム終了直前に親ディレクトリを差し替える
    let swapped = false;
    respondWith('PNG-BYTES', {
      beforeEnd: async () => {
        await fsp.rm(`${destPath}`, { force: true });
        const tmp = `${destPath}.downloading`;
        const keep = await fsp.readFile(tmp).catch(() => null);
        await fsp.rm(tmp, { force: true });
        await fsp.rm(gradeDir, { recursive: true, force: true });
        swapped = await makeJunction(gradeDir, outsideDir);
        if (swapped && keep) {
          // 一時ファイルはリンク先へ移しておく（rename 直前の状態を再現）
          await fsp.writeFile(
            path.join(outsideDir, 'key1.png.downloading'),
            keep,
          );
        }
      },
    });

    const promise = downloadWithVerify({
      url: 'https://example.test/signed',
      destPath,
    });

    // 差し替えを検出して失敗すること（pipeline の書き込み失敗ではなく検査で止まる）
    await expect(promise).rejects.toThrow(/symlink|link|directory|ENOENT/i);
    if (!swapped) return;

    // rename 直前の再検査で止まるため、リンク先に完成ファイルは作られない
    expect(fs.existsSync(path.join(outsideDir, 'key1.png'))).toBe(false);
  });

  it('一時ファイルが symlink の場合は書き込まずに失敗する', async () => {
    const destPath = path.join(gradeDir, 'key1.png');
    const outsideTmp = path.join(outsideDir, 'stolen.downloading');
    try {
      await fsp.symlink(outsideTmp, `${destPath}.downloading`, 'file');
    } catch {
      return;
    }

    await expect(
      downloadWithVerify({ url: 'https://example.test/signed', destPath }),
    ).rejects.toThrow(/symlink/i);

    expect(fs.existsSync(outsideTmp)).toBe(false);
  });

  it('MD5 が一致しない場合は一時ファイルを残さず失敗する', async () => {
    const destPath = path.join(gradeDir, 'key1.png');

    await expect(
      downloadWithVerify({
        url: 'https://example.test/signed',
        destPath,
        expectedMd5: 'unexpected-md5',
      }),
    ).rejects.toThrow(/MD5 mismatch/);

    expect(fs.existsSync(`${destPath}.downloading`)).toBe(false);
    expect(fs.existsSync(destPath)).toBe(false);
  });
});

describe('失敗時の後始末が junction 先を壊さない（第3回レビュー指摘1）', () => {
  /** 書き込み完了後に学年ディレクトリを junction へ差し替え、外部に同名ファイルを置く */
  const swapAfterWrite = async (destPath: string) => {
    const tmpName = `${path.basename(destPath)}.downloading`;
    // 外部側の同名ファイル（消されてはいけない）
    await fsp.writeFile(path.join(outsideDir, tmpName), 'VICTIM');
    await fsp.rm(gradeDir, { recursive: true, force: true });
    return makeJunction(gradeDir, outsideDir);
  };

  it('MD5不一致の後始末でリンク先の同名ファイルを削除しない', async () => {
    const destPath = path.join(gradeDir, 'key1.png');
    let swapped = false;

    respondWith('PNG-BYTES', {
      beforeEnd: async () => {
        swapped = await swapAfterWrite(destPath);
      },
    });

    // 後始末を省略しても、報告すべき元のエラーが維持される
    await expect(
      downloadWithVerify({
        url: 'https://example.test/signed',
        destPath,
        expectedMd5: 'unexpected-md5',
      }),
    ).rejects.toThrow(/MD5 mismatch/);

    if (!swapped) return;
    // リンク先の同名ファイルが残る
    await expect(
      fsp.readFile(path.join(outsideDir, 'key1.png.downloading'), 'utf8'),
    ).resolves.toBe('VICTIM');
  });

  it('通信・書き込み失敗の後始末でもリンク先の同名ファイルを削除しない', async () => {
    const destPath = path.join(gradeDir, 'key1.png');
    let swapped = false;

    mocks.gotStream.mockImplementation(() => {
      const stream = new PassThrough();
      queueMicrotask(async () => {
        stream.write('PARTIAL');
        swapped = await swapAfterWrite(destPath);
        stream.destroy(new Error('network failed'));
      });
      return stream;
    });

    // 後始末を省略しても、報告すべき元のエラーが維持される
    await expect(
      downloadWithVerify({ url: 'https://example.test/signed', destPath }),
    ).rejects.toThrow(/network failed/);

    if (!swapped) return;
    await expect(
      fsp.readFile(path.join(outsideDir, 'key1.png.downloading'), 'utf8'),
    ).resolves.toBe('VICTIM');
  });

  it('学年ディレクトリが存在しない場合は作らずに失敗する', async () => {
    await fsp.rm(gradeDir, { recursive: true, force: true });
    const destPath = path.join(gradeDir, 'key1.png');

    await expect(
      downloadWithVerify({ url: 'https://example.test/signed', destPath }),
    ).rejects.toThrow(/does not exist/);

    // ディレクトリを作らない
    expect(fs.existsSync(gradeDir)).toBe(false);
    expect(mocks.gotStream).not.toHaveBeenCalled();
  });
});

describe('親検査に失敗したら後続処理へ進まない（第4回レビュー指摘1）', () => {
  it('既存の完成ファイルがある通常状態では置き換えられる', async () => {
    const destPath = path.join(gradeDir, 'key1.png');
    await fsp.writeFile(destPath, 'OLD');
    await fsp.writeFile(`${destPath}.downloading`, 'STALE');

    await downloadWithVerify({
      url: 'https://example.test/signed',
      destPath,
    });

    await expect(fsp.readFile(destPath, 'utf8')).resolves.toBe('PNG-BYTES');
    expect(fs.existsSync(`${destPath}.downloading`)).toBe(false);
  });

  it('親が危険な状態では書き込みも rename も行わない', async () => {
    // 事前検査の時点で junction。書き込み・rename のいずれにも到達しない
    await fsp.rm(gradeDir, { recursive: true, force: true });
    if (!(await makeJunction(gradeDir, outsideDir))) return;

    const destPath = path.join(gradeDir, 'key1.png');
    // リンク先に同名ファイルを置き、削除も置換もされないことを確認する
    await fsp.writeFile(path.join(outsideDir, 'key1.png'), 'VICTIM');
    await fsp.writeFile(
      path.join(outsideDir, 'key1.png.downloading'),
      'VICTIM',
    );

    await expect(
      downloadWithVerify({ url: 'https://example.test/signed', destPath }),
    ).rejects.toThrow(/symlink|link/i);

    expect(mocks.gotStream).not.toHaveBeenCalled();
    await expect(
      fsp.readFile(path.join(outsideDir, 'key1.png'), 'utf8'),
    ).resolves.toBe('VICTIM');
    await expect(
      fsp.readFile(path.join(outsideDir, 'key1.png.downloading'), 'utf8'),
    ).resolves.toBe('VICTIM');
  });
});

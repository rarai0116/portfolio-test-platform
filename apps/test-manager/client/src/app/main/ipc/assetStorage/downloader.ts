import { createHash } from 'node:crypto';
import { createWriteStream, promises as fsp } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import got from 'got';

/**
 * 対象パスが symlink / junction でないことを確認する（設計8.2）。
 * 存在しない場合は問題なしとして扱う。
 */
async function assertNotSymlink(targetPath: string): Promise<void> {
  try {
    const stat = await fsp.lstat(targetPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`symlink is not allowed for asset file: ${targetPath}`);
    }
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') {
      return;
    }
    throw e;
  }
}

/**
 * 書き込み先の親ディレクトリが symlink / junction でないことを確認する（設計8.2）。
 *
 * 親が junction の場合、最終要素の lstat だけでは検出できず（存在しなければ ENOENT、
 * 存在すれば通常ファイルに見える）、リンク先へ書き込めてしまう。
 * 呼び出し側の事前検査から書き込みまでの間に差し替えられる余地を無くすため、
 * 書き込み直前と最終rename直前にこの関数で再検査する。
 */
async function assertSafeParentDirectory(targetPath: string): Promise<void> {
  const dir = resolvePath(dirname(targetPath));

  let stat: Awaited<ReturnType<typeof fsp.lstat>>;
  try {
    stat = await fsp.lstat(dir);
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') {
      // 作成は呼び出し側（ensureGradeDirectory）の責務。ここでは作らない。
      throw new Error(`asset directory does not exist: ${dir}`);
    }
    throw e;
  }

  if (stat.isSymbolicLink()) {
    throw new Error(`asset directory must not be a symlink: ${dir}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`asset directory is not a directory: ${dir}`);
  }

  const real = await fsp.realpath(dir);
  if (resolvePath(real) !== dir) {
    throw new Error(`asset directory resolves through a link: ${dir}`);
  }
}

/**
 * 失敗時の後始末専用の削除（設計8.2）。
 *
 * 親が junction へ差し替えられている状態で rm すると、リンク先の同名ファイルを
 * 削除してしまうため、安全を確認できない場合は削除を省略する。
 * ここで例外にすると、本来報告すべき通信失敗や MD5 不一致が失われるため、
 * 呼び出し元の元のエラーを維持する。
 * リンクが外れた実ディレクトリ側に一時ファイルが残ることは許容する。
 */
async function removeIfSafe(targetPath: string): Promise<void> {
  try {
    await assertSafeParentDirectory(targetPath);
  } catch (e) {
    console.warn(
      '[assets] skipped removing file behind an unsafe directory',
      targetPath,
      e instanceof Error ? e.message : e,
    );
    return;
  }

  // symlink 自体の削除はリンク先に影響しないため、ここでは許可する。
  await fsp.rm(targetPath, { force: true });
}

/**
 * 親ディレクトリの安全を確認してから削除する（設計8.2）。
 *
 * 確認できない場合は例外にして処理を中止する。
 * 危険を検出したまま書き込みや rename へ進まないよう、
 * 後続の操作がある削除にはこちらを使う。
 */
async function removeVerified(targetPath: string): Promise<void> {
  await assertSafeParentDirectory(targetPath);
  // symlink 自体の削除はリンク先に影響しない。
  await fsp.rm(targetPath, { force: true });
}

export async function downloadWithVerify(params: {
  url: string;
  destPath: string; // 最終保存先
  expectedMd5?: string; // Firestoreに記録されたmd5Hash（base64）
  timeoutMs?: number; // 既定 30s
  maxRetries?: number; // 既定 3
  onProgress?: (transferred: number, total?: number) => void;
}) {
  const {
    url,
    destPath,
    expectedMd5,
    timeoutMs = 30_000,
    maxRetries = 3,
    onProgress,
  } = params;

  const tmpPath = `${destPath}.downloading`;

  // ファイル操作より前に親ディレクトリを検査する（設計8.2）。
  // ディレクトリ作成はここでは行わない。mkdir は junction 越しでもリンク先へ
  // 作成してしまうため、作成・検証は呼び出し側の ensureGradeDirectory に任せる。
  await assertSafeParentDirectory(destPath);

  // 一時ファイルの symlink 経由書き込みを防ぐ（設計8.2）。
  // flags:'wx' は Windows では既存 symlink を弾かず、リンク先へ書けてしまうため、
  // 事前に明示的に確認・除去する。
  await assertNotSymlink(tmpPath);
  await removeVerified(tmpPath);
  await assertNotSymlink(destPath);

  const hasher = createHash('md5');
  let totalBytes = 0;

  console.log(`Downloading from ${url} to ${destPath} ...`);
  const stream = got.stream(url, {
    timeout: { request: timeoutMs },
    retry: {
      limit: maxRetries,
      methods: ['GET'],
      statusCodes: [408, 429, 500, 502, 503, 504],
    },
    throwHttpErrors: true,
  });

  stream.on('downloadProgress', (p) => {
    onProgress?.(p.transferred, p.total);
  });

  const tee = new PassThrough();
  tee.on('data', (chunk: Buffer) => {
    totalBytes += chunk.length;
    hasher.update(chunk);
  });

  const file = createWriteStream(tmpPath, { flags: 'wx' });

  try {
    await pipeline(stream, tee, file);
  } catch (e) {
    await removeIfSafe(tmpPath).catch(() => {});
    throw e;
  }

  const md5Base64 = hasher.digest('base64');
  if (expectedMd5 && md5Base64 !== expectedMd5) {
    await removeIfSafe(tmpPath).catch(() => {});
    throw new Error(
      `MD5 mismatch: expected=${expectedMd5}, actual=${md5Base64}`,
    );
  }

  // 最終パスへ置き換える直前にも親ディレクトリと symlink を拒否する
  // （書込中に差し替えられた場合の防御）
  await assertSafeParentDirectory(destPath);
  await assertNotSymlink(destPath);
  await removeVerified(destPath);
  await fsp.rename(tmpPath, destPath);

  return { bytes: totalBytes, md5Base64 };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { StartupError } from '@main/startup/fatalStartup';
import { ASSET_VERSION_PATTERN } from '@shared/types/assets';
import type { AssetRow } from './db';

/**
 * 画像アセットのローカル状態を扱う共通処理。
 * protocol handler と AssetManager が同じ検証・同じversion判定を使うために切り出している
 * （設計2.2「ready を返せるのは共通検証できた画像だけ」/ 設計8章）。
 */

export type AssetRootInfo = {
  /** userData/assets の実体パス */
  root: string;
};

/**
 * アセットルートを初期化する（設計8.1）。
 * 失敗はphase付きのStartupErrorとして投げ、共通の起動失敗処理へ渡す。
 */
export async function initializeAssetRoot(
  userDataPath: string,
): Promise<AssetRootInfo> {
  let userDataReal: string;
  try {
    userDataReal = await fs.realpath(userDataPath);
  } catch (e) {
    throw new StartupError(
      'asset-root-realpath',
      'failed to resolve userData realpath',
      { cause: e },
    );
  }

  const assetsPath = path.join(userDataReal, 'assets');

  try {
    await fs.mkdir(assetsPath, { recursive: true });
  } catch (e) {
    throw new StartupError('asset-root-create', 'failed to create asset root', {
      cause: e,
    });
  }

  try {
    const lstat = await fs.lstat(assetsPath);
    // symlink / junction のアセットルートは信頼しない。
    if (lstat.isSymbolicLink()) {
      throw new StartupError(
        'asset-root-trust-check',
        'asset root must not be a symlink or junction',
      );
    }
    if (!lstat.isDirectory()) {
      throw new StartupError(
        'asset-root-trust-check',
        'asset root must be a directory',
      );
    }
  } catch (e) {
    if (e instanceof StartupError) {
      throw e;
    }
    throw new StartupError(
      'asset-root-trust-check',
      'failed to inspect asset root',
      { cause: e },
    );
  }

  let root: string;
  try {
    root = await fs.realpath(assetsPath);
  } catch (e) {
    throw new StartupError(
      'asset-root-realpath',
      'failed to resolve asset root realpath',
      { cause: e },
    );
  }

  if (!isInside(userDataReal, root)) {
    throw new StartupError(
      'asset-root-trust-check',
      'asset root resolved outside of userData',
    );
  }

  return { root };
}

/** parent の配下（parent自身は含まない）かどうか。独自の小文字化や正規化は行わない。 */
const isInside = (parent: string, target: string): boolean => {
  const relative = path.relative(parent, target);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};

export const buildAssetFilePath = (
  root: string,
  grade: string,
  key: string,
): string => path.join(root, grade, `${key}.png`);

export type AssetFileVerificationFailure =
  /** ファイルが存在しない。異常ではなく未取得として扱う */
  | 'missing'
  /** local_file_path が正規パスと異なる */
  | 'path-mismatch'
  /** 経路上に symlink / junction がある */
  | 'symlink'
  /** 通常ファイルではない */
  | 'not-regular-file'
  | 'stat-failed';

export type AssetFileVerification =
  | { ok: true; size: number }
  | { ok: false; reason: AssetFileVerificationFailure };

/** セキュリティ検証の失敗（未取得を除く）かどうか */
export const isAssetFileSecurityFailure = (
  reason: AssetFileVerificationFailure,
): boolean =>
  reason === 'path-mismatch' ||
  reason === 'symlink' ||
  reason === 'not-regular-file';

/**
 * ファイル応答直前の検証（設計8.2）。
 * symlink / junction は一切許可しない。
 *
 * 1. local_file_path が正規の assets/{grade}/{key}.png と一致すること
 * 2. realpath が同じ正規パスであること
 *    （経路上のどこかにリンクがあれば解決結果が変わるため、
 *     ファイル自身のリンクも親ディレクトリのjunctionもこれで検出できる）
 * 3. lstat が通常ファイルであること
 *    （最終要素が symlink の場合 isFile() は false になる）
 */
export async function verifyAssetFile(params: {
  root: string;
  grade: string;
  key: string;
  filePath: string;
}): Promise<AssetFileVerification> {
  const { root, grade, key, filePath } = params;

  const expectedPath = buildAssetFilePath(root, grade, key);

  // 1. DBが保持するパスが正規パスと一致するか（ファイルへ触れる前に判定する）
  if (path.resolve(filePath) !== expectedPath) {
    return { ok: false, reason: 'path-mismatch' };
  }

  // 3. 最終要素が symlink でない通常ファイルであること
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(expectedPath);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    return { ok: false, reason: code === 'ENOENT' ? 'missing' : 'stat-failed' };
  }

  if (stat.isSymbolicLink()) {
    return { ok: false, reason: 'symlink' };
  }
  if (!stat.isFile()) {
    return { ok: false, reason: 'not-regular-file' };
  }

  // 2. 経路上にリンクが無いこと
  let fileReal: string;
  try {
    fileReal = await fs.realpath(expectedPath);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    return { ok: false, reason: code === 'ENOENT' ? 'missing' : 'stat-failed' };
  }

  if (fileReal !== expectedPath) {
    return { ok: false, reason: 'symlink' };
  }

  return { ok: true, size: stat.size };
}

/**
 * 学年ディレクトリを作成・検証する（設計8.1）。
 * symlink / junction は拒否し、通常ディレクトリであることを確認する。
 * ダウンロードでファイルを書き込む前に必ず通す。
 */
export async function ensureGradeDirectory(
  root: string,
  grade: string,
): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const gradeDir = path.join(root, grade);
  if (path.dirname(gradeDir) !== root) {
    return { ok: false, reason: 'path-mismatch' };
  }

  try {
    await fs.mkdir(gradeDir, { recursive: true });
  } catch (e) {
    return { ok: false, reason: `mkdir-failed:${(e as Error).message}` };
  }

  try {
    const stat = await fs.lstat(gradeDir);
    if (stat.isSymbolicLink()) {
      return { ok: false, reason: 'symlink' };
    }
    if (!stat.isDirectory()) {
      return { ok: false, reason: 'not-directory' };
    }
  } catch (e) {
    return { ok: false, reason: `stat-failed:${(e as Error).message}` };
  }

  return { ok: true, path: gradeDir };
}

export type ClearTargetVerification =
  | { ok: true; path: string; exists: boolean }
  | {
      ok: false;
      reason: 'path-mismatch' | 'symlink' | 'not-directory' | 'stat-failed';
    };

/**
 * clearCache の削除対象を、削除を始める前に検証する（設計8.1 / 8.2）。
 *
 * 再帰削除は開始地点を辿ってしまうため、ここで symlink / junction を拒否する。
 * `readdir` の dirent は配下の junction を isSymbolicLink()=true で返すので、
 * 配下は既存の分岐で辿らない。開始地点だけがこの検証を必要とする。
 */
export type DirectoryRemovalFailure =
  | 'path-mismatch'
  | 'symlink'
  | 'not-directory'
  | 'stat-failed';

export type DirectoryRemovalVerification =
  | { ok: true; exists: boolean }
  | { ok: false; reason: DirectoryRemovalFailure };

/**
 * 削除のために走査してよいディレクトリかを確認する（設計8.1 / 8.2）。
 * アセットルート自身と、その配下のディレクトリの両方に使う。
 * 走査（readdir）の直前に毎回呼び、検証と操作の間隔を最小にする。
 */
export async function verifyDirectoryForRemoval(
  dirPath: string,
  root: string,
): Promise<DirectoryRemovalVerification> {
  const rootResolved = path.resolve(root);
  const target = path.resolve(dirPath);

  if (target !== rootResolved && !isInside(rootResolved, target)) {
    return { ok: false, reason: 'path-mismatch' };
  }

  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(target);
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === 'ENOENT') {
      // 消すものが無いだけなので、異常ではない。
      return { ok: true, exists: false };
    }
    return { ok: false, reason: 'stat-failed' };
  }

  if (stat.isSymbolicLink()) {
    return { ok: false, reason: 'symlink' };
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: 'not-directory' };
  }

  try {
    const real = await fs.realpath(target);
    if (path.resolve(real) !== target) {
      // 経路上のどこかにリンクがある。
      return { ok: false, reason: 'symlink' };
    }
  } catch {
    return { ok: false, reason: 'stat-failed' };
  }

  return { ok: true, exists: true };
}

export async function verifyClearTarget(
  root: string,
  grade?: string,
): Promise<ClearTargetVerification> {
  const rootResolved = path.resolve(root);

  // アセットルート自身を必ず先に検査する。
  // 学年ディレクトリの不在判定は、ルートが安全と確認できた後にだけ行う。
  const rootVerification = await verifyDirectoryForRemoval(
    rootResolved,
    rootResolved,
  );
  if (!rootVerification.ok) {
    return { ok: false, reason: rootVerification.reason };
  }
  if (!rootVerification.exists) {
    return { ok: true, path: rootResolved, exists: false };
  }

  if (!grade) {
    return { ok: true, path: rootResolved, exists: true };
  }

  const target = path.join(rootResolved, grade);
  // 学年指定はアセットルート直下だけを許可する。
  if (path.resolve(path.dirname(target)) !== rootResolved) {
    return { ok: false, reason: 'path-mismatch' };
  }

  const gradeVerification = await verifyDirectoryForRemoval(
    target,
    rootResolved,
  );
  if (!gradeVerification.ok) {
    return { ok: false, reason: gradeVerification.reason };
  }

  return { ok: true, path: target, exists: gradeVerification.exists };
}

/**
 * base64形式のMD5をURL-safeな version へ正規化する（設計3.2）。
 * MD5の再解釈をrendererへ持ち出さないため、変換はこの1箇所だけで行う。
 */
export const toUrlSafeVersion = (md5Base64: string): string =>
  md5Base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

/**
 * AssetRow から現在の version を決める（設計3.2）。
 * md5_hash を優先し、無ければ updated_at_ms を使う。
 * URL規則を満たせない値は version なしとして扱う。
 */
export const resolveAssetVersion = (
  row: Pick<AssetRow, 'md5_hash' | 'updated_at_ms'> | undefined,
): string | undefined => {
  if (!row) {
    return undefined;
  }

  if (typeof row.md5_hash === 'string' && row.md5_hash.length > 0) {
    const normalized = toUrlSafeVersion(row.md5_hash);
    if (ASSET_VERSION_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  if (
    typeof row.updated_at_ms === 'number' &&
    Number.isFinite(row.updated_at_ms)
  ) {
    const normalized = String(Math.trunc(row.updated_at_ms));
    if (ASSET_VERSION_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  return undefined;
};

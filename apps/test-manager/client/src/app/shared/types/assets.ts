import type { AssetData, GradeId } from './contracts';

export type AssetKey = { grade: GradeId; key: string };

export const AssetChannels = {
  request: 'assets:request', // Renderer -> Main
  prioritize: 'assets:prioritize', // Renderer -> Main
  ready: 'assets:ready', // Main -> Renderer
  progress: 'assets:progress', // Main -> Renderer (必要なら)
  error: 'assets:error', // Main -> Renderer
  clearCache: 'assets:clearCache', // Renderer -> Main
  cancel: 'assets:cancel', // Renderer -> Main
  upload: 'assets:upload', // Renderer -> Main
  uploadBuffer: 'assets:uploadBuffer', // Renderer -> Main
  replace: 'assets:replace', // Renderer -> Main
  delete: 'assets:delete', // Renderer -> Main
  loadFailure: 'assets:loadFailure', // Renderer -> Main (demo-asset URL の表示失敗報告)
  loadSuccess: 'assets:loadSuccess', // Renderer -> Main (r付きURLの表示成功報告)
} as const;

export type AssetsRequestPayload = {
  items: AssetKey[];
};

/**
 * ready 応答・通知で renderer へ渡すメタ情報。画像本体は含めない。
 * URL は buildAssetUrl() でのみ生成する。
 */
export type AssetReadyNotice = {
  grade: GradeId;
  key: string;
  contentType?: string;
  version?: string;
  recoveryToken?: string;
};

export type AssetRequestFailureReason =
  | 'recovery-exhausted'
  | 'asset-deleted'
  | 'asset-not-found'
  | 'asset-state-unavailable';

export type AssetRequestFailure = {
  grade: GradeId;
  key: string;
  version?: string;
  reason: AssetRequestFailureReason;
  message: string;
};

export type AssetsRequestResult =
  | {
      ok: true;
      ready: AssetReadyNotice[]; // すぐ表示できるもの（画像本体は含めない）
      pending: AssetKey[]; // ダウンロードが必要なもの
      failed: AssetRequestFailure[]; // 削除済み・不存在・状態確認不能・回復上限
    }
  | {
      ok: false;
      error: string;
    };

export type AssetLoadReport = {
  grade: GradeId;
  key: string;
  version?: string;
  recoveryToken?: string;
};

export type AssetLoadFailureResult =
  | {
      ok: true;
      status:
        | 'recovery-started'
        | 'already-recovering'
        | 'stale-refreshed'
        | 'retry-exhausted';
    }
  | { ok: false; error: string };

export type AssetLoadSuccessResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// demo-asset URL（設計3.1 / 9.3）
// buildAssetUrl() を URL 生成の唯一の入口とし、parseAssetUrl() を
// main の protocol handler と renderer の表示失敗回復で共有する。
// ---------------------------------------------------------------------------

export const ASSET_PROTOCOL_SCHEME = 'demo-asset';
export const ASSET_URL_HOST = 'images';
const ASSET_URL_PREFIX = `${ASSET_PROTOCOL_SCHEME}://${ASSET_URL_HOST}/`;

export const ASSET_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const ASSET_VERSION_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// 128bit 乱数の base64url は必ず22文字になる。
export const ASSET_RECOVERY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const ASSET_GRADES: readonly GradeId[] = ['firstGrade', 'secondGrade'];

export type ParsedAssetUrl = {
  grade: GradeId;
  key: string;
  version?: string;
  recoveryToken?: string;
};

/**
 * grade / key の実行時検証（設計8章）。
 * 型定義だけでは IPC 経由の不正値を防げないため、main の入口で必ず使う。
 */
export const isGradeId = (value: unknown): value is GradeId =>
  typeof value === 'string' &&
  (ASSET_GRADES as readonly string[]).includes(value);

export const isAssetKeyString = (value: unknown): value is string =>
  typeof value === 'string' && ASSET_KEY_PATTERN.test(value);

export const isAssetKey = (value: unknown): value is AssetKey => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { grade?: unknown; key?: unknown };
  return isGradeId(candidate.grade) && isAssetKeyString(candidate.key);
};

/**
 * 画像アセットURLを生成する。不正な識別子は URL を組み立てずに例外とする
 * （main が正規化済みの値だけを renderer へ渡す前提を壊さないため）。
 */
export const buildAssetUrl = (notice: {
  grade: GradeId;
  key: string;
  version?: string;
  recoveryToken?: string;
}): string => {
  if (!isGradeId(notice.grade)) {
    throw new Error(`invalid asset grade: ${notice.grade}`);
  }
  if (!ASSET_KEY_PATTERN.test(notice.key)) {
    throw new Error(`invalid asset key: ${notice.key}`);
  }
  if (
    notice.version !== undefined &&
    !ASSET_VERSION_PATTERN.test(notice.version)
  ) {
    throw new Error(`invalid asset version: ${notice.version}`);
  }
  if (
    notice.recoveryToken !== undefined &&
    !ASSET_RECOVERY_TOKEN_PATTERN.test(notice.recoveryToken)
  ) {
    throw new Error(`invalid asset recovery token: ${notice.recoveryToken}`);
  }

  // query は v → r の順だけを許可する（parseAssetUrl も逆順を拒否する）。
  const query: string[] = [];
  if (notice.version !== undefined) {
    query.push(`v=${notice.version}`);
  }
  if (notice.recoveryToken !== undefined) {
    query.push(`r=${notice.recoveryToken}`);
  }

  const suffix = query.length > 0 ? `?${query.join('&')}` : '';
  return `${ASSET_URL_PREFIX}${notice.grade}/${notice.key}.png${suffix}`;
};

/**
 * 画像アセットURLを検証して分解する。未知query、重複query、逆順、fragment、
 * 不正な grade / key / version / token はすべて null を返す。
 */
export const parseAssetUrl = (url: string): ParsedAssetUrl | null => {
  if (typeof url !== 'string' || !url.startsWith(ASSET_URL_PREFIX)) {
    return null;
  }
  if (url.includes('#')) {
    return null;
  }

  const rest = url.slice(ASSET_URL_PREFIX.length);
  const queryStart = rest.indexOf('?');
  const pathPart = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const queryPart = queryStart === -1 ? null : rest.slice(queryStart + 1);

  // 2つ目以降の '?' は未知の並びとして拒否する。
  if (queryPart?.includes('?')) {
    return null;
  }

  const pathMatch = /^([^/]+)\/([^/]+)\.png$/.exec(pathPart);
  if (!pathMatch) {
    return null;
  }

  const [, grade, key] = pathMatch;
  if (!isGradeId(grade) || !ASSET_KEY_PATTERN.test(key)) {
    return null;
  }

  if (queryPart === null) {
    return { grade, key };
  }

  const versionOnly = /^v=([A-Za-z0-9_-]{1,64})$/.exec(queryPart);
  if (versionOnly) {
    return { grade, key, version: versionOnly[1] };
  }

  const tokenOnly = /^r=([A-Za-z0-9_-]{22})$/.exec(queryPart);
  if (tokenOnly) {
    return { grade, key, recoveryToken: tokenOnly[1] };
  }

  const both = /^v=([A-Za-z0-9_-]{1,64})&r=([A-Za-z0-9_-]{22})$/.exec(
    queryPart,
  );
  if (both) {
    return { grade, key, version: both[1], recoveryToken: both[2] };
  }

  return null;
};

export type AssetsPrioritizePayload = {
  items: AssetKey[];
  priority?: number; // 既定は少し高め（例: 10）
};

export type AssetsProgressEvent = {
  grade: GradeId;
  key: string;
  transferred: number;
  total?: number;
};

export type AssetsErrorEvent = {
  grade: GradeId;
  key: string;
  message: string;
};

// アップロード用ペイロード/結果型
export type AssetUploadPayload = {
  filePath: string;
  grade: GradeId;
  timeoutMs?: number; // Firestore登録待機のタイムアウト（任意、既定15_000）
};

export type AssetUploadBufferPayload = {
  fileName: string;
  bytes: Uint8Array;
  grade: GradeId;
  contentType?: string;
  timeoutMs?: number;
};

export type AssetUploadResult =
  | {
      ok: true;
      grade: GradeId;
      key: string;
      objectPath: string;
      filePath: string;
      data: AssetData;
    }
  | {
      ok: false;
      error: string;
    };

// 削除用ペイロード/結果型
export type AssetDeletePayload = {
  grade: GradeId;
  key: string;
};

export type AssetDeleteResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };
export type AssetCancelPayload = {
  items: AssetKey[];
};

export type AssetCancelResult =
  | {
      ok: true;
      canceled: number;
    }
  | {
      ok: false;
      error: string;
    };
export type AssetReplacePayload = {
  filePath: string;
  grade: GradeId;
  key: string;
  timeoutMs?: number;
};

export type AssetReplaceResult =
  | {
      ok: true;
      grade: GradeId;
      key: string;
      objectPath: string;
      filePath: string;
      data: AssetData;
    }
  | {
      ok: false;
      error: string;
    };

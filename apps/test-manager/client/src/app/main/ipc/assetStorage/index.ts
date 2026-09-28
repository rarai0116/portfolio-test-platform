import path from 'node:path';
import type { FirestoreCacheManager } from '@main/ipc/firestore/cacheManager';
import type { FirestoreClient } from '@main/ipc/firestore/clients';
import type { FirestoreMutationExecutor } from '@main/ipc/firestore/mutationExecutor';
import { StartupError } from '@main/startup/fatalStartup';
import type {
  AssetCancelPayload,
  AssetCancelResult,
  AssetDeletePayload,
  AssetDeleteResult,
  AssetKey,
  AssetLoadFailureResult,
  AssetLoadReport,
  AssetLoadSuccessResult,
  AssetReplacePayload,
  AssetReplaceResult,
  AssetsPrioritizePayload,
  AssetsRequestPayload,
  AssetsRequestResult,
  AssetUploadBufferPayload,
  AssetUploadPayload,
  AssetUploadResult,
} from '@shared/types/assets';
import {
  AssetChannels,
  isAssetKey,
  isAssetKeyString,
  isGradeId,
} from '@shared/types/assets';
import type {
  AssetData,
  CachedDoc,
  GradeId,
  TestSubject,
} from '@shared/types/contracts';
import { app, type BrowserWindow, ipcMain } from 'electron';
import {
  type AssetChangeNotice,
  type AssetManager,
  type AssetMetaResolveResult,
  createAssetManager,
} from './assetManager';
import { registerAssetProtocol } from './assetProtocol';

const ASSET_COLLECTION_PATHS = [
  'storageList/firstGrade/images',
  'storageList/secondGrade/images',
] as const;

const INVALID_ASSET_KEY_ERROR = 'grade と key が不正です';

/**
 * clearCache の scope を検証する（設計8章）。
 * 受理するのは undefined（全体クリア）と { grade: 有効なGradeId }（学年指定）だけ。
 * null や配列、grade を持たないオブジェクトを全体クリアへ落とさない。
 */
const validateClearScope = (
  value: unknown,
): { ok: true; scope: { grade: GradeId } | undefined } | { ok: false } => {
  if (value === undefined) {
    return { ok: true, scope: undefined };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false };
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'grade') {
    return { ok: false };
  }

  const grade = (value as { grade?: unknown }).grade;
  return isGradeId(grade) ? { ok: true, scope: { grade } } : { ok: false };
};

/** IPC 入力の AssetKey 配列を検証する（設計8章。型だけでは実行時の不正値を防げない） */
const validateAssetKeys = (value: unknown): AssetKey[] | null => {
  if (!Array.isArray(value)) return null;
  return value.every(isAssetKey) ? (value as AssetKey[]) : null;
};

const ASSET_IPC_CHANNELS = [
  AssetChannels.request,
  AssetChannels.prioritize,
  AssetChannels.cancel,
  AssetChannels.clearCache,
  AssetChannels.upload,
  AssetChannels.uploadBuffer,
  AssetChannels.replace,
  AssetChannels.delete,
  AssetChannels.loadFailure,
  AssetChannels.loadSuccess,
] as const;

// mainプロセスに1つだけ生成する（設計4.1）。
let assetManagerSingleton: AssetManager | null = null;

export const getAssetManager = (): AssetManager | null => assetManagerSingleton;

const toAssetData = (
  key: AssetKey,
  data: Record<string, unknown>,
): AssetData => {
  const typed = data as {
    objectPath?: string;
    objecttPath?: string;
    md5Hash?: string;
    contentType?: string;
    size?: number;
    updatedAt?: AssetData['updatedAt'];
    bigCategoryTag?: string;
    smallCategoryTag?: string;
    subject?: TestSubject;
    tag?: string[];
    title?: string;
    usedIds?: string[];
    width?: number;
    height?: number;
    deleted?: boolean;
  };

  return {
    grade: key.grade,
    key: key.key,
    deleted: typed.deleted === true,
    objectPath: typed.objectPath ?? typed.objecttPath,
    md5Hash: typed.md5Hash,
    contentType: typed.contentType,
    size: typeof typed.size === 'number' ? typed.size : undefined,
    updatedAt: typed.updatedAt,
    bigCategoryTag: typed.bigCategoryTag,
    smallCategoryTag: typed.smallCategoryTag,
    subject: typed.subject,
    tag: typed.tag,
    title: typed.title,
    usedIds: typed.usedIds,
    width: typed.width,
    height: typed.height,
  } satisfies AssetData;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assetDocPath = (key: AssetKey) =>
  `storageList/${key.grade}/images/${key.key}`;

/**
 * 通常のメタ取得（cache-first）。削除済みも区別できるよう内部APIを使う（設計4.7）。
 */
const createCacheFirstMetaResolver =
  (cacheManager: FirestoreCacheManager, client: FirestoreClient) =>
  async (key: AssetKey): Promise<AssetMetaResolveResult> => {
    const docPath = assetDocPath(key);

    try {
      const cached = await cacheManager.getCachedDocIncludingDeleted(docPath);

      if (cached.kind === 'active' && isPlainRecord(cached.doc.data)) {
        cacheManager.recordAssetMetric({ type: 'meta-cache-hit' });
        return {
          kind: 'found-active',
          data: toAssetData(key, cached.doc.data),
        };
      }

      if (cached.kind === 'deleted') {
        cacheManager.recordAssetMetric({ type: 'meta-cache-hit' });
        return {
          kind: 'found-deleted',
          data: isPlainRecord(cached.doc.data)
            ? toAssetData(key, cached.doc.data)
            : undefined,
        };
      }

      // ローカルcacheに無い場合だけ公開getDocへ委譲する（削除済みは除外される）。
      const doc = await client.getDoc(docPath);
      if (!doc || !isPlainRecord(doc.data)) {
        return { kind: 'not-found' };
      }
      return { kind: 'found-active', data: toAssetData(key, doc.data) };
    } catch (error) {
      return { kind: 'unavailable', error };
    }
  };

/**
 * サーバー確認用のメタ取得（設計4.6）。SDK cacheを使わない。
 */
const createServerMetaResolver =
  (cacheManager: FirestoreCacheManager) =>
  async (key: AssetKey): Promise<AssetMetaResolveResult> => {
    try {
      const result = await cacheManager.getDocFromServerIncludingDeleted(
        assetDocPath(key),
      );

      if (result.kind === 'not-found') {
        return { kind: 'not-found' };
      }

      const data = isPlainRecord(result.doc.data)
        ? toAssetData(key, result.doc.data)
        : undefined;

      if (result.kind === 'deleted') {
        return { kind: 'found-deleted', data };
      }

      return data ? { kind: 'found-active', data } : { kind: 'not-found' };
    } catch (error) {
      return { kind: 'unavailable', error };
    }
  };

const toChangeNotice = (
  collectionPath: string,
  doc: CachedDoc,
): AssetChangeNotice | null => {
  const grade = collectionPath.split('/')[1] as GradeId;
  if (grade !== 'firstGrade' && grade !== 'secondGrade') {
    return null;
  }

  const data = isPlainRecord(doc.data) ? doc.data : {};
  const asset = toAssetData({ grade, key: doc.key }, data);
  const updatedAtMs = doc.updateTime
    ? doc.updateTime.seconds * 1000 +
      Math.floor(doc.updateTime.nanos / 1_000_000)
    : null;

  return {
    grade,
    key: doc.key,
    deleted: asset.deleted === true,
    updatedAtMs,
    md5Hash: asset.md5Hash,
    objectPath: asset.objectPath,
    contentType: asset.contentType,
    size: asset.size,
  };
};

/**
 * AssetManager singleton を初期化し、protocol と IPC を登録する（設計4.2）。
 * すべて成功した場合だけ singleton を公開し、失敗時は登録済みIPCとDB接続を巻き戻す。
 */
export async function initializeAssetStorage(params: {
  mainWindow: BrowserWindow;
  cacheManager: FirestoreCacheManager;
  client: FirestoreClient;
  executor: FirestoreMutationExecutor;
}): Promise<AssetManager> {
  const { mainWindow, cacheManager, client, executor } = params;

  if (assetManagerSingleton) {
    // macOSのwindow再生成では初期化・IPC登録・購読を繰り返さず、通知先だけ更新する。
    assetManagerSingleton.updateMainWindow(mainWindow);
    return assetManagerSingleton;
  }

  const userDataPath = app.getPath('userData');
  const manager = await createAssetManager({
    userDataPath,
    dbPath: path.join(userDataPath, 'assets.db'),
    deps: {
      mainWindow,
      resolveMeta: createCacheFirstMetaResolver(cacheManager, client),
      resolveMetaFromServer: createServerMetaResolver(cacheManager),
      deleteFirestoreAssetDoc: async (docPath: string) => {
        await executor.execute({ kind: 'delete', path: docPath });
      },
      recordAssetMetric: (action) => {
        cacheManager.recordAssetMetric(action);
      },
      options: {
        concurrency: 3,
        expiresSec: 900,
      },
    },
  });

  // IPC 登録・変更通知購読・protocol 登録がすべて成功した場合だけ singleton を公開する
  // （設計4.2）。途中で失敗した場合は登録済みIPCと購読とDB接続を巻き戻す。
  try {
    registerAssetIpcHandlers(manager);

    // Firestore listener を新設せず、既存の変更通知へ受信callbackを追加するだけ（設計6.4）。
    for (const collectionPath of ASSET_COLLECTION_PATHS) {
      const unsubscribe = cacheManager.onCollectionChanged(
        collectionPath,
        (docs) => {
          const notices = docs
            .map((doc) => toChangeNotice(collectionPath, doc))
            .filter((notice): notice is AssetChangeNotice => notice !== null);
          if (notices.length > 0) {
            void manager.handleChangeNotices(notices);
          }
        },
      );
      manager.registerChangeSubscription(unsubscribe);
    }

    registerAssetProtocol(getAssetManager);
  } catch (e) {
    for (const channel of ASSET_IPC_CHANNELS) {
      ipcMain.removeHandler(channel);
    }
    // dispose() が購読解除とDB closeを行う
    manager.dispose();
    throw new StartupError(
      'asset-ipc-register',
      'failed to register asset storage handlers',
      { cause: e },
    );
  }

  assetManagerSingleton = manager;
  return manager;
}

function registerAssetIpcHandlers(manager: AssetManager) {
  for (const channel of ASSET_IPC_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(
    AssetChannels.request,
    async (
      _evt,
      payload: AssetsRequestPayload,
    ): Promise<AssetsRequestResult> => {
      try {
        const items = validateAssetKeys(payload?.items ?? []);
        if (!items) {
          return { ok: false, error: INVALID_ASSET_KEY_ERROR };
        }
        const { ready, pending, failed } = await manager.request(items);
        return { ok: true, ready, pending, failed };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    AssetChannels.prioritize,
    async (_evt, payload: AssetsPrioritizePayload) => {
      const items = validateAssetKeys(payload?.items ?? []);
      if (!items) {
        return { ok: false, error: INVALID_ASSET_KEY_ERROR };
      }
      await manager.prioritize(items, payload.priority ?? 20);
      return { ok: true };
    },
  );

  ipcMain.handle(
    AssetChannels.cancel,
    async (_evt, payload: AssetCancelPayload): Promise<AssetCancelResult> => {
      try {
        const items = validateAssetKeys(payload?.items ?? []);
        if (!items) {
          return { ok: false, error: INVALID_ASSET_KEY_ERROR };
        }

        const result = await manager.cancel(items);
        return { ok: true, canceled: result.canceled };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(AssetChannels.clearCache, async (_ev, scope?: unknown) => {
    try {
      const validated = validateClearScope(scope);
      if (!validated.ok) {
        return { ok: false, error: INVALID_ASSET_KEY_ERROR } as const;
      }
      const res = await manager.clearCache(validated.scope);
      return { ok: true, removedFiles: res.removedFiles } as const;
    } catch (e: unknown) {
      if (e instanceof Error) {
        return { ok: false, error: e.message } as const;
      }
      return { ok: false, error: String(e) } as const;
    }
  });

  ipcMain.handle(
    AssetChannels.upload,
    async (_evt, payload: AssetUploadPayload): Promise<AssetUploadResult> => {
      const { filePath, grade, timeoutMs } = payload ?? {};
      if (!filePath || !isGradeId(grade)) {
        return { ok: false, error: 'filePath と grade は必須です' };
      }
      return manager.uploadLocalFile({ filePath, grade, timeoutMs });
    },
  );

  ipcMain.handle(
    AssetChannels.uploadBuffer,
    async (
      _evt,
      payload: AssetUploadBufferPayload,
    ): Promise<AssetUploadResult> => {
      const { fileName, bytes, grade, contentType, timeoutMs } = payload ?? {};
      if (!fileName || !isGradeId(grade) || !bytes || bytes.length === 0) {
        return { ok: false, error: 'fileName と bytes と grade は必須です' };
      }

      return manager.uploadBinaryFile({
        fileName,
        bytes,
        grade,
        contentType,
        timeoutMs,
      });
    },
  );

  ipcMain.handle(
    AssetChannels.replace,
    async (_evt, payload: AssetReplacePayload): Promise<AssetReplaceResult> => {
      const { filePath, grade, key, timeoutMs } = payload ?? {};
      if (!filePath || !isGradeId(grade) || !isAssetKeyString(key)) {
        return { ok: false, error: 'filePath と grade と key は必須です' };
      }

      return manager.replaceAsset({ filePath, grade, key, timeoutMs });
    },
  );

  ipcMain.handle(
    AssetChannels.delete,
    async (_evt, payload: AssetDeletePayload): Promise<AssetDeleteResult> => {
      try {
        const { grade, key } = payload ?? ({} as AssetDeletePayload);
        if (!isGradeId(grade) || !isAssetKeyString(key)) {
          return { ok: false, error: INVALID_ASSET_KEY_ERROR };
        }

        await manager.deleteAsset({ grade, key });
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    AssetChannels.loadFailure,
    async (_evt, payload: AssetLoadReport): Promise<AssetLoadFailureResult> => {
      try {
        return await manager.reportLoadFailure(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );

  ipcMain.handle(
    AssetChannels.loadSuccess,
    async (_evt, payload: AssetLoadReport): Promise<AssetLoadSuccessResult> => {
      try {
        return await manager.reportLoadSuccess(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );
}

/** テストと明示破棄用。singleton を解放する。 */
export function disposeAssetStorage(): void {
  for (const channel of ASSET_IPC_CHANNELS) {
    ipcMain.removeHandler(channel);
  }
  assetManagerSingleton?.dispose();
  assetManagerSingleton = null;
}

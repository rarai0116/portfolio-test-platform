/** biome-ignore-all lint/suspicious/noExplicitAny: テスト用モックのため */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (evt: unknown, payload: unknown) => unknown>(),
  handle: vi.fn(),
  removeHandler: vi.fn(),
  createAssetManager: vi.fn(),
  registerAssetProtocol: vi.fn(),
  onCollectionChanged: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/userData') },
  ipcMain: {
    handle: mocks.handle,
    removeHandler: mocks.removeHandler,
  },
}));

vi.mock('./assetManager', () => ({
  createAssetManager: mocks.createAssetManager,
}));

vi.mock('./assetProtocol', () => ({
  registerAssetProtocol: mocks.registerAssetProtocol,
}));

import { AssetChannels } from '@shared/types/assets';
import {
  disposeAssetStorage,
  getAssetManager,
  initializeAssetStorage,
} from './index';

const createStubManager = () => ({
  request: vi.fn(async () => ({ ready: [], pending: [], failed: [] })),
  prioritize: vi.fn(async () => {}),
  cancel: vi.fn(async () => ({ canceled: 0 })),
  clearCache: vi.fn(async () => ({ removedFiles: 0 })),
  replaceAsset: vi.fn(async () => ({ ok: true })),
  deleteAsset: vi.fn(async () => {}),
  uploadLocalFile: vi.fn(async () => ({ ok: true })),
  uploadBinaryFile: vi.fn(async () => ({ ok: true })),
  reportLoadFailure: vi.fn(async () => ({
    ok: true,
    status: 'stale-refreshed',
  })),
  reportLoadSuccess: vi.fn(async () => ({ ok: true, confirmed: false })),
  handleChangeNotices: vi.fn(async () => {}),
  registerChangeSubscription: vi.fn(),
  updateMainWindow: vi.fn(),
  dispose: vi.fn(),
});

let manager: ReturnType<typeof createStubManager>;

const deps = () => ({
  mainWindow: {} as never,
  cacheManager: {
    onCollectionChanged: mocks.onCollectionChanged,
    recordAssetMetric: vi.fn(),
  } as never,
  client: {} as never,
  executor: { execute: vi.fn() } as never,
});

const invoke = (channel: string, payload: unknown) => {
  const handler = mocks.handlers.get(channel);
  if (!handler) throw new Error(`handler not registered: ${channel}`);
  return handler({}, payload);
};

beforeEach(async () => {
  disposeAssetStorage();
  vi.clearAllMocks();
  mocks.handlers.clear();
  mocks.handle.mockImplementation(
    (channel: string, handler: (evt: unknown, payload: unknown) => unknown) => {
      mocks.handlers.set(channel, handler);
    },
  );
  mocks.onCollectionChanged.mockReturnValue(vi.fn());
  manager = createStubManager();
  mocks.createAssetManager.mockResolvedValue(manager);
  await initializeAssetStorage(deps());
});

describe('asset IPC の入力検証（設計8章）', () => {
  it('不正な grade の request は処理せず ok:false を返す', async () => {
    const res: any = await invoke(AssetChannels.request, {
      items: [{ grade: '../../etc', key: 'key1' }],
    });

    expect(res.ok).toBe(false);
    expect(manager.request).not.toHaveBeenCalled();
  });

  it('不正な key の request は処理せず ok:false を返す', async () => {
    const res: any = await invoke(AssetChannels.request, {
      items: [{ grade: 'firstGrade', key: '../secret' }],
    });

    expect(res.ok).toBe(false);
    expect(manager.request).not.toHaveBeenCalled();
  });

  it('正しい grade / key の request は処理される', async () => {
    const res: any = await invoke(AssetChannels.request, {
      items: [{ grade: 'firstGrade', key: 'key1' }],
    });

    expect(res.ok).toBe(true);
    expect(manager.request).toHaveBeenCalledWith([
      { grade: 'firstGrade', key: 'key1' },
    ]);
  });

  it('不正な grade の clearCache はアセット削除を実行しない', async () => {
    const res: any = await invoke(AssetChannels.clearCache, {
      grade: '..\\..\\..',
    });

    expect(res.ok).toBe(false);
    expect(manager.clearCache).not.toHaveBeenCalled();
  });

  it('grade 未指定の clearCache は全体クリアとして実行される', async () => {
    const res: any = await invoke(AssetChannels.clearCache, undefined);

    expect(res.ok).toBe(true);
    expect(manager.clearCache).toHaveBeenCalledWith(undefined);
  });

  it('不正な grade / key の delete と replace は処理しない', async () => {
    const deleteRes: any = await invoke(AssetChannels.delete, {
      grade: 'thirdGrade',
      key: 'key1',
    });
    expect(deleteRes.ok).toBe(false);
    expect(manager.deleteAsset).not.toHaveBeenCalled();

    const replaceRes: any = await invoke(AssetChannels.replace, {
      filePath: 'C:/tmp/a.png',
      grade: 'firstGrade',
      key: '../evil',
    });
    expect(replaceRes.ok).toBe(false);
    expect(manager.replaceAsset).not.toHaveBeenCalled();
  });

  it('不正な grade の prioritize と cancel は処理しない', async () => {
    const prioritizeRes: any = await invoke(AssetChannels.prioritize, {
      items: [{ grade: 'x', key: 'key1' }],
    });
    expect(prioritizeRes.ok).toBe(false);
    expect(manager.prioritize).not.toHaveBeenCalled();

    const cancelRes: any = await invoke(AssetChannels.cancel, {
      items: [{ grade: 'firstGrade', key: '' }],
    });
    expect(cancelRes.ok).toBe(false);
    expect(manager.cancel).not.toHaveBeenCalled();
  });

  it('不正な grade の upload は処理しない', async () => {
    const res: any = await invoke(AssetChannels.upload, {
      filePath: 'C:/tmp/a.png',
      grade: 'notAGrade',
    });

    expect(res.ok).toBe(false);
    expect(manager.uploadLocalFile).not.toHaveBeenCalled();
  });
});

describe('singleton の公開条件（設計4.2）', () => {
  it('protocol 登録が失敗した場合は singleton を公開せず巻き戻す', async () => {
    disposeAssetStorage();
    vi.clearAllMocks();
    mocks.handlers.clear();
    const failing = createStubManager();
    mocks.createAssetManager.mockResolvedValue(failing);
    mocks.registerAssetProtocol.mockImplementationOnce(() => {
      throw new Error('protocol registration failed');
    });

    await expect(initializeAssetStorage(deps())).rejects.toThrow();

    expect(getAssetManager()).toBeNull();
    expect(failing.dispose).toHaveBeenCalledTimes(1);
    // 登録済み IPC を解除している
    expect(mocks.removeHandler).toHaveBeenCalledWith(AssetChannels.request);
  });

  it('成功時は protocol 登録の後に singleton を公開する', () => {
    expect(getAssetManager()).not.toBeNull();
    expect(mocks.registerAssetProtocol).toHaveBeenCalledTimes(1);
  });
});

describe('clearCache scope の厳格化（再レビュー指摘3）', () => {
  it('undefined と { grade: 有効なGradeId } だけを受理する', async () => {
    const valid: any = await invoke(AssetChannels.clearCache, {
      grade: 'secondGrade',
    });
    expect(valid.ok).toBe(true);
    expect(manager.clearCache).toHaveBeenCalledWith({ grade: 'secondGrade' });
  });

  it('grade を持たない不正な値を全体クリアへ落とさない', async () => {
    const invalidScopes = [
      null,
      'firstGrade',
      [],
      { typoGrade: 'firstGrade' },
      { grade: 'firstGrade', extra: 1 },
      {},
    ];

    for (const scope of invalidScopes) {
      const res: any = await invoke(AssetChannels.clearCache, scope);
      expect(res.ok).toBe(false);
    }

    expect(manager.clearCache).not.toHaveBeenCalled();
  });
});

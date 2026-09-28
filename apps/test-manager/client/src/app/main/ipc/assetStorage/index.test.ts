/** biome-ignore-all lint/suspicious/noExplicitAny: モック時に型を定めることができないため */
import { AssetChannels } from '@shared/types/assets';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: unknown, payload: any) => void;

const importWithElectronMock = async () => {
  vi.resetModules();

  // チャネル毎の listener を保持する簡易バス
  const listeners = new Map<string, Set<Listener>>();

  vi.doMock('electron', () => {
    const on = vi.fn((channel: string, cb: Listener) => {
      const set = listeners.get(channel) ?? new Set<Listener>();
      set.add(cb);
      listeners.set(channel, set);
    });
    const off = vi.fn((channel: string, cb: Listener) => {
      const set = listeners.get(channel);
      set?.delete(cb);
    });

    const ipcRenderer = {
      invoke: vi.fn(), // テスト側で挙動上書き
      on,
      off,
    };

    const contextBridge = {
      exposeInMainWorld: vi.fn((key: string, api: any) => {
        // @ts-expect-error
        window[key] = api;
      }),
    };

    return { contextBridge, ipcRenderer, __listeners: listeners };
  });

  // preload を読み込むと window.assets が公開される
  await import('../../../preload/assets');
  const electron = await import('electron');

  // @ts-expect-error
  const assets = window.assets as {
    request: (items: any[]) => Promise<any>;
    prioritize: (items: any[], priority?: number) => Promise<any>;
    onReady: (h: (item: any) => void) => () => void;
    onError: (h: (e: unknown) => void) => () => void;
    onProgress: (h: (e: unknown) => void) => () => void;
    clearCache: (scope?: { grade?: string }) => Promise<any>;
    upload: (
      filePath: string,
      grade: string,
      timeoutMs?: number,
    ) => Promise<any>;
    uploadBuffer: (
      fileName: string,
      bytes: Uint8Array,
      grade: string,
      contentType?: string,
      timeoutMs?: number,
    ) => Promise<any>;
    replace: (
      filePath: string,
      grade: string,
      key: string,
      timeoutMs?: number,
    ) => Promise<any>;
    cancel: (filter?: { grade?: string; items?: any[] }) => Promise<any>;
    delete: (payload: {
      grade: string;
      key: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
  };

  return { assets, electron, listeners };
};

describe('[preload] assets API', () => {
  beforeEach(() => {
    // noop
  });

  it('request が assets:request を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();
    const items = ['a', { id: 1, grade: 'A' }];

    // 成功レスポンスをモック（ready は空、pending あり）
    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === 'assets:request') {
          return Promise.resolve({
            ok: true,
            ready: [],
            pending: payload.items,
          });
        }
        return Promise.resolve(undefined);
      },
    );

    const res = await assets.request(items);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('assets:request', {
      items,
    });
    expect(res).toEqual({ ok: true, ready: [], pending: items });
  });

  it('prioritize が assets:prioritize を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();
    (electron.ipcRenderer.invoke as any).mockResolvedValue(undefined);

    await assets.prioritize(['x', 'y'], 10);
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      'assets:prioritize',
      {
        items: ['x', 'y'],
        priority: 10,
      },
    );
  });

  it('onReady で購読/解除でき、ハンドラが呼ばれる', async () => {
    const { assets, electron, listeners } = await importWithElectronMock();

    const handler = vi.fn();
    const unsubscribe = assets.onReady(handler);

    // listener を取り出して擬似イベント発火
    const set = listeners.get(AssetChannels.ready);
    if (!set) throw new Error('listener set not found');
    expect(set.size).toBe(1);
    const listener = [...set][0];
    const item = { key: 'foo', url: '/foo' };
    listener(undefined, item);

    expect(handler).toHaveBeenCalledWith(item);

    // 解除できる
    unsubscribe();
    expect(electron.ipcRenderer.off).toHaveBeenCalledTimes(1);
  });

  it('onError / onProgress も購読/解除できる', async () => {
    const { assets, electron, listeners } = await importWithElectronMock();

    const hErr = vi.fn();
    const hProg = vi.fn();
    const offErr = assets.onError(hErr);
    const offProg = assets.onProgress(hProg);

    // error
    const errSet = listeners.get(AssetChannels.error);
    if (!errSet) throw new Error('listener set not found');
    const errListener = [...errSet][0];
    const errPayload = { key: { id: 1, grade: 'G' }, message: 'boom' };
    errListener(undefined, errPayload);
    expect(hErr).toHaveBeenCalledWith(errPayload);

    // progress
    const progSet = listeners.get(AssetChannels.progress);
    if (!progSet) throw new Error('listener set not found');
    const progListener = [...progSet][0];
    const progPayload = { key: 'bar', loaded: 10, total: 100 };
    progListener(undefined, progPayload);
    expect(hProg).toHaveBeenCalledWith(progPayload);

    offErr();
    offProg();
    expect(electron.ipcRenderer.off).toHaveBeenCalledTimes(2);
  });

  it('clearCache(scope) は inflight を先にキャンセルし、その後キャッシュ削除を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();

    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === AssetChannels.request) {
          return Promise.resolve({
            ok: true,
            ready: [],
            pending: payload.items,
          });
        }
        return Promise.resolve(undefined);
      },
    );

    const a = { id: '1', grade: 'A' };
    const b = { id: '2', grade: 'B' };
    await assets.request([a, b]);

    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, _payload: any) => {
        if (channel === AssetChannels.cancel) {
          return Promise.resolve({
            ok: true,
            canceled: 1,
          });
        }
        if (channel === AssetChannels.clearCache) {
          return Promise.resolve({
            ok: true,
            removedFiles: 0,
          });
        }
        return Promise.resolve(undefined);
      },
    );

    await assets.clearCache({ grade: 'A' });

    const calls = (electron.ipcRenderer.invoke as any).mock.calls.map(
      (c: any[]) => [c[0], c[1]],
    );

    expect(calls[0]).toEqual([AssetChannels.request, { items: [a, b] }]);
    expect(calls[1][0]).toBe(AssetChannels.cancel);
    expect(calls[1][1]).toEqual({ items: [a] });
    expect(calls[2]).toEqual([AssetChannels.clearCache, { grade: 'A' }]);
  });

  it('upload が assets:upload を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();
    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === AssetChannels.upload) {
          return Promise.resolve({
            ok: true,
            grade: payload.grade,
            key: 'sample',
            objectPath: `original/${payload.grade}/sample.png`,
            data: {
              grade: payload.grade,
              key: 'sample',
              objectPath: `original/${payload.grade}/sample.png`,
              contentType: 'image/png',
              size: 123,
            },
          });
        }
        return Promise.resolve(undefined);
      },
    );
    const res = await assets.upload('./sample.png', 'firstGrade');
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      AssetChannels.upload,
      {
        filePath: './sample.png',
        grade: 'firstGrade',
        timeoutMs: undefined,
      },
    );
    expect(res.ok).toBe(true);
    expect(res.objectPath).toBe('original/firstGrade/sample.png');
  });

  it('uploadBuffer が assets:uploadBuffer を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();
    const bytes = new Uint8Array([1, 2, 3]);

    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === AssetChannels.uploadBuffer) {
          return Promise.resolve({
            ok: true,
            grade: payload.grade,
            key: 'buffer-sample',
            objectPath: `original/${payload.grade}/buffer-sample.png`,
            filePath: payload.fileName,
            data: {
              grade: payload.grade,
              key: 'buffer-sample',
              objectPath: `original/${payload.grade}/buffer-sample.png`,
              contentType: 'image/png',
              size: 3,
            },
          });
        }
        return Promise.resolve(undefined);
      },
    );

    const res = await assets.uploadBuffer(
      'sample.png',
      bytes,
      'firstGrade',
      'image/png',
    );

    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      AssetChannels.uploadBuffer,
      {
        fileName: 'sample.png',
        bytes,
        grade: 'firstGrade',
        contentType: 'image/png',
        timeoutMs: undefined,
      },
    );
    expect(res.ok).toBe(true);
    expect(res.objectPath).toBe('original/firstGrade/buffer-sample.png');
  });

  // 変更箇所: describe 内に追加
  it('replace が assets:replace を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();

    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === AssetChannels.replace) {
          return Promise.resolve({
            ok: true,
            grade: payload.grade,
            key: payload.key,
            objectPath: `original/${payload.grade}/${payload.key}.png`,
            filePath: payload.filePath,
            data: {
              grade: payload.grade,
              key: payload.key,
              objectPath: `original/${payload.grade}/${payload.key}.png`,
              contentType: 'image/png',
              size: 456,
            },
          });
        }
        return Promise.resolve(undefined);
      },
    );

    const res = await assets.replace(
      './sample.png',
      'firstGrade',
      'sample-key',
    );

    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(
      AssetChannels.replace,
      {
        filePath: './sample.png',
        grade: 'firstGrade',
        key: 'sample-key',
        timeoutMs: undefined,
      },
    );
    expect(res.ok).toBe(true);
    expect(res.key).toBe('sample-key');
  });

  it('cancel が assets:cancel を invoke する', async () => {
    const { assets, electron } = await importWithElectronMock();

    (electron.ipcRenderer.invoke as any).mockImplementation(
      (channel: string, payload: any) => {
        if (channel === AssetChannels.request) {
          return Promise.resolve({
            ok: true,
            ready: [],
            pending: payload.items,
          });
        }
        if (channel === AssetChannels.cancel) {
          return Promise.resolve({
            ok: true,
            canceled: 1,
          });
        }
        return Promise.resolve(undefined);
      },
    );

    const item = { grade: 'firstGrade', key: 'img1' };

    await assets.request([item]);
    const res = await assets.cancel({ items: [item] });

    expect(electron.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      1,
      AssetChannels.request,
      { items: [item] },
    );
    expect(electron.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      2,
      AssetChannels.cancel,
      { items: [item] },
    );
    expect(res).toEqual({ ok: true, canceled: 1 });
  });
});

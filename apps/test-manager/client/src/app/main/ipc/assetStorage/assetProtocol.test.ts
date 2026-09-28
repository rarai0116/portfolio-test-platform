import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  protocol: { handle: mocks.handle },
}));

import type { AssetManager } from './assetManager';
import {
  cacheControlForUrl,
  handleAssetProtocolRequest,
  registerAssetProtocol,
} from './assetProtocol';

let workDir = '';
let filePath = '';

const managerWith = (
  resolveProtocolRequest: AssetManager['resolveProtocolRequest'],
): AssetManager => ({ resolveProtocolRequest }) as unknown as AssetManager;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-asset-protocol-'));
  filePath = path.join(workDir, 'key1.png');
  await fs.writeFile(filePath, 'image-bytes');
  mocks.handle.mockReset();
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('cacheControlForUrl', () => {
  it('v または r があれば immutable、どちらも無ければ no-cache になる', () => {
    expect(cacheControlForUrl({ grade: 'firstGrade', key: 'k' })).toBe(
      'no-cache',
    );
    expect(
      cacheControlForUrl({ grade: 'firstGrade', key: 'k', version: 'v1' }),
    ).toBe('public, max-age=31536000, immutable');
    expect(
      cacheControlForUrl({
        grade: 'firstGrade',
        key: 'k',
        recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toBe('public, max-age=31536000, immutable');
  });
});

describe('handleAssetProtocolRequest', () => {
  it('URL不正は400を返し、AssetManagerへ問い合わせない', async () => {
    const resolve = vi.fn();
    const response = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png?x=1' },
      () => managerWith(resolve as never),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('AssetManager未初期化は503を返す', async () => {
    const response = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png' },
      () => null,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('unavailable判定は503、not-found判定は404 / no-storeになる', async () => {
    const unavailable = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png' },
      () => managerWith(async () => ({ kind: 'unavailable' }) as never),
    );
    expect(unavailable.status).toBe(503);

    const notFound = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png' },
      () => managerWith(async () => ({ kind: 'not-found' }) as never),
    );
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get('Cache-Control')).toBe('no-store');
  });

  it('検証済みファイルはstreamで返し、Content-TypeとCache-Controlを設定する', async () => {
    const response = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png?v=abc' },
      () =>
        managerWith(
          async () =>
            ({
              kind: 'file',
              filePath,
              size: 'image-bytes'.length,
              contentType: 'image/png',
            }) as never,
        ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Content-Length')).toBe(
      String('image-bytes'.length),
    );
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
    await expect(response.text()).resolves.toBe('image-bytes');
  });

  it('parse結果はAssetManagerへそのまま渡される', async () => {
    const resolve = vi.fn(async () => ({ kind: 'not-found' }));
    await handleAssetProtocolRequest(
      {
        url: 'demo-asset://images/secondGrade/k1.png?v=abc&r=AAAAAAAAAAAAAAAAAAAAAA',
      },
      () => managerWith(resolve as never),
    );

    expect(resolve).toHaveBeenCalledWith({
      grade: 'secondGrade',
      key: 'k1',
      version: 'abc',
      recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    });
  });

  it('AssetManagerが例外を投げた場合は503を返す', async () => {
    const response = await handleAssetProtocolRequest(
      { url: 'demo-asset://images/firstGrade/k1.png' },
      () =>
        managerWith(async () => {
          throw new Error('boom');
        }),
    );
    expect(response.status).toBe(503);
  });

  it('registerAssetProtocol は demo-asset スキームを登録する', () => {
    registerAssetProtocol(() => null);
    expect(mocks.handle).toHaveBeenCalledTimes(1);
    expect(mocks.handle.mock.calls[0][0]).toBe('demo-asset');
  });
});

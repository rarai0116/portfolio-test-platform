import fs from 'node:fs';
import { Readable } from 'node:stream';
import {
  ASSET_PROTOCOL_SCHEME,
  type ParsedAssetUrl,
  parseAssetUrl,
} from '@shared/types/assets';
import { protocol } from 'electron';
import type { AssetManager } from './assetManager';

/**
 * demo-asset:// のカスタムプロトコル配信（設計2.3 / 3.4 / 8.2）。
 * URL検証と応答生成だけを担当し、状態判定は AssetManager の
 * 専用公開メソッドを1回呼ぶだけに留める（設計7.1）。
 */

const NO_STORE = 'no-store';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const NO_CACHE = 'no-cache';

/** Cache-Control は URL の v / r の有無で決まる（設計3.4） */
export const cacheControlForUrl = (parsed: ParsedAssetUrl): string =>
  parsed.version !== undefined || parsed.recoveryToken !== undefined
    ? IMMUTABLE
    : NO_CACHE;

export const buildAssetErrorResponse = (status: 400 | 404 | 503): Response =>
  new Response(null, {
    status,
    headers: { 'Cache-Control': NO_STORE },
  });

/**
 * 1リクエスト分の応答を組み立てる。
 * AssetManager が未初期化（singleton なし）やルート異常の場合は 503 を返す。
 */
export async function handleAssetProtocolRequest(
  request: { url: string },
  getManager: () => AssetManager | null,
): Promise<Response> {
  const parsed = parseAssetUrl(request.url);
  if (!parsed) {
    // URL不正はキューへ登録しない。
    return buildAssetErrorResponse(400);
  }

  const manager = getManager();
  if (!manager) {
    return buildAssetErrorResponse(503);
  }

  let resolution: Awaited<ReturnType<AssetManager['resolveProtocolRequest']>>;
  try {
    resolution = await manager.resolveProtocolRequest(parsed);
  } catch (e) {
    console.warn('[assets] protocol resolution failed', request.url, e);
    return buildAssetErrorResponse(503);
  }

  if (resolution.kind === 'unavailable') {
    return buildAssetErrorResponse(503);
  }

  if (resolution.kind === 'not-found') {
    return buildAssetErrorResponse(404);
  }

  try {
    const stream = Readable.toWeb(
      fs.createReadStream(resolution.filePath),
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      status: 200,
      headers: {
        // Content-Type は DB の content_type、欠落時は image/png（設計2.3）
        'Content-Type': resolution.contentType,
        'Content-Length': String(resolution.size),
        'Cache-Control': cacheControlForUrl(parsed),
      },
    });
  } catch (e) {
    console.warn('[assets] failed to open asset file stream', request.url, e);
    return buildAssetErrorResponse(404);
  }
}

/** default session へ protocol handler を登録する（設計3.5） */
export function registerAssetProtocol(
  getManager: () => AssetManager | null,
): void {
  protocol.handle(ASSET_PROTOCOL_SCHEME, (request) =>
    handleAssetProtocolRequest(request, getManager),
  );
}

import { DUMMY_IMG } from '@api/dummyImage';
import { parseAssetUrl } from '@shared/types/assets';

/**
 * demo-asset URL の表示失敗からの回復（設計5.2 / 10.2）。
 *
 * DOM は失敗検知と表示先だけを担当する。回復回数・キュー・現在phaseの正本は
 * main の AssetManager が持ち、ここでは `data-asset-load-failed` だけを持つ。
 *
 * mainWindow、PDFプレビューwindow、testDataEditor iframe の各 document へ
 * 1回ずつ設置する。capture方式の error / load listener 各1本で、
 * WeakSet により二重登録を防ぐ。
 */

export const ASSET_LOAD_FAILED_ATTRIBUTE = 'data-asset-load-failed';

/**
 * React 自身が onError / onLoad を処理する img の目印（設計10.5）。
 * 共通listenerと二重に報告しないよう、この属性を持つ要素は無視する。
 */
export const REACT_MANAGED_ASSET_ATTRIBUTE = 'data-asset-recovery-react';

const installedDocuments = new WeakSet<Document>();

const isImageElement = (
  target: EventTarget | null,
): target is HTMLImageElement =>
  target instanceof HTMLImageElement ||
  (typeof HTMLImageElement === 'undefined' &&
    (target as { tagName?: string } | null)?.tagName === 'IMG');

const assetsApi = () =>
  (globalThis as { assets?: Window['assets'] }).assets ?? undefined;

const handleImageError = (event: Event) => {
  const image = event.target;
  if (!isImageElement(image)) return;
  if (image.hasAttribute(REACT_MANAGED_ASSET_ATTRIBUTE)) return;

  const failedUrl = image.getAttribute('src') ?? '';
  const parsed = parseAssetUrl(failedUrl);
  if (!parsed) return;

  // 失敗URLをparseして保持し、表示はダミーへ戻す。
  image.setAttribute(ASSET_LOAD_FAILED_ATTRIBUTE, '1');
  image.src = DUMMY_IMG;

  void assetsApi()
    ?.reportLoadFailure({
      grade: parsed.grade,
      key: parsed.key,
      version: parsed.version,
      recoveryToken: parsed.recoveryToken,
    })
    .catch(() => {
      // IPC失敗時も表示中画像をダミーへ戻したまま失敗マーカーを残す（設計5.5）。
    });
};

const handleImageLoad = (event: Event) => {
  const image = event.target;
  if (!isImageElement(image)) return;
  if (image.hasAttribute(REACT_MANAGED_ASSET_ATTRIBUTE)) return;

  const loadedUrl = image.getAttribute('src') ?? '';
  const parsed = parseAssetUrl(loadedUrl);
  // 通常の r なし load では成功IPCを送らない（設計5.5）。
  if (!parsed?.recoveryToken) return;

  void assetsApi()
    ?.reportLoadSuccess({
      grade: parsed.grade,
      key: parsed.key,
      version: parsed.version,
      recoveryToken: parsed.recoveryToken,
    })
    .then((result) => {
      // confirmed の場合だけ失敗マーカーを解除する。
      if (result?.ok && result.confirmed) {
        image.removeAttribute(ASSET_LOAD_FAILED_ATTRIBUTE);
      }
    })
    .catch(() => {
      // confirmed=false や IPC失敗では表示中画像をダミーへ戻さない。
    });
};

export const installImageErrorRecovery = (doc: Document | null | undefined) => {
  if (!doc || installedDocuments.has(doc)) {
    return;
  }
  installedDocuments.add(doc);

  // img の error / load はバブルしないため capture で受ける。
  doc.addEventListener('error', handleImageError, true);
  doc.addEventListener('load', handleImageLoad, true);
};

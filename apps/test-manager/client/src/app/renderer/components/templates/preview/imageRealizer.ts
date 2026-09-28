// ファイル名: apps/client/src/app/renderer/components/templates/preview/imageRealizer.ts
// <img alt="key"> を demo-asset URL の src へ差し替える

import { ASSET_LOAD_FAILED_ATTRIBUTE } from '@api/imageErrorRecovery';
import type { ImageAsset, ImageAssetMap } from '@stores/useImageAssetStore';

export const realizeImages = (html: string, images: ImageAssetMap): string => {
  if (!html || !images) return html;
  const regImgs = html.match(/<img\s*alt="([^"]*)"\s*[^>]*/gi);
  if (!regImgs) return html;
  let out = html;
  for (let i = 0; i < regImgs.length; i++) {
    const matchKey = out.match(/<img\s*alt="([^"]*)"\s*[^>]*/i);
    if (!matchKey) continue;
    const key = matchKey[1];
    const img = images[key];
    if (!img?.url) continue;
    out = out.replace(
      /(<img\s*)(alt=")([^"]*)("\s*)([^>]*)/i,
      `$1src="${img.url}" $2$3$4$5`,
    );
  }
  return out;
};

/** 表示に使う src を返す（画像本体は protocol 経由で読む） */
export const toAssetSrc = (asset: ImageAsset): string => asset.url;

/**
 * <img> のキーを推定して返す
 * - data-asset-key 優先
 * - 次点で data-key / alt / title
 * - src が "asset:{key}" / "image:{key}" の場合も対応
 */
const resolveImgKey = (img: HTMLImageElement): string | undefined => {
  const datasetKey = (
    img.getAttribute('data-asset-key') || img.getAttribute('data-key')
  )?.trim();
  if (datasetKey) return datasetKey;

  const alt = img.getAttribute('alt')?.trim();
  if (alt) return alt;

  const title = img.getAttribute('title')?.trim();
  if (title) return title;

  const src = img.getAttribute('src') || '';
  const m = src.match(/^(asset|image):(.+)$/);
  if (m?.[2]) return m[2].trim();

  return undefined;
};

const MAX_REALIZED_IMAGE_WIDTH = 2900;

const normalizeImageDimensions = (
  width?: number,
  height?: number,
): { width?: number; height?: number } => {
  if (!width || !height) return { width, height };
  if (width <= MAX_REALIZED_IMAGE_WIDTH) return { width, height };

  const scale = MAX_REALIZED_IMAGE_WIDTH / width;
  return {
    width: MAX_REALIZED_IMAGE_WIDTH,
    height: Math.round(height * scale),
  };
};

/**
 * 与えられたコンテナ内の <img> を assets の data URL に差し替える
 * 差し替え対象:
 * - data-asset-key / data-key / alt / title / src="asset:{key}" / src="image:{key}"
 * 未解決のキーはそのまま
 */
export const realizeDomImages = (
  container: HTMLElement,
  assets: ImageAssetMap,
  width?: number,
  height?: number,
): void => {
  const imgs = container.querySelectorAll('img');
  /*
  console.log(
    'Realizing images in DOM container:',
    container.innerHTML,
    'with assets:',
    assets,
    'found images:',
    imgs,
  );
  */
  imgs.forEach((img) => {
    const key = resolveImgKey(img as HTMLImageElement);
    if (!key) return;
    const asset = assets[key];
    if (!asset) return;
    const url = toAssetSrc(asset);
    // 同一URLでも、表示失敗マーカーが残っている場合は再適用する（設計10.5）。
    const hasFailureMarker =
      img.getAttribute(ASSET_LOAD_FAILED_ATTRIBUTE) === '1';
    if (img.getAttribute('src') !== url || hasFailureMarker) {
      img.removeAttribute(ASSET_LOAD_FAILED_ATTRIBUTE);
      img.setAttribute('src', url);
    }

    // asset 単位の寬・高さを優先し、未設定の場合は引数のグローバル値をフォールバックする
    const w = asset.width ?? width;
    const h = asset.height ?? height;
    const normalized = normalizeImageDimensions(w, h);

    if (w) {
      img.setAttribute('data-preview-asset-width', String(w));
    } else {
      img.removeAttribute('data-preview-asset-width');
    }
    if (h) {
      img.setAttribute('data-preview-asset-height', String(h));
    } else {
      img.removeAttribute('data-preview-asset-height');
    }
    if (normalized.width) {
      img.setAttribute('width', String(normalized.width));
    }
    if (normalized.height) {
      img.setAttribute('height', String(normalized.height));
    }
    if (!w || !h) {
      markImageSizeMissing(img as HTMLImageElement, key);
    } else {
      clearImageSizeMissing(img as HTMLImageElement, key);
    }
  });
};

const markImageSizeMissing = (img: HTMLImageElement, key: string) => {
  if (
    img.nextElementSibling &&
    img.nextElementSibling instanceof HTMLElement &&
    img.nextElementSibling.dataset.previewImageErrorFor === key
  ) {
    img.nextElementSibling.remove();
  }

  img.setAttribute('data-preview-image-error', 'missing-size');
};

const clearImageSizeMissing = (img: HTMLImageElement, key: string) => {
  img.removeAttribute('data-preview-image-error');
  if (
    img.nextElementSibling &&
    img.nextElementSibling instanceof HTMLElement &&
    img.nextElementSibling.dataset.previewImageErrorFor === key
  ) {
    img.nextElementSibling.remove();
  }
};

/**
 * HTML文字列を受け取り、<img> を data URL に変換した HTML を返す
 * ブラウザの DOMParser を使って安全に書き換え
 */
export const realizeHtmlImages = (
  html: string,
  assets: ImageAssetMap,
): string => {
  // SSR/Electronで DOMParser が無い場合はフォールバック
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  if (!doc?.body) return html;
  realizeDomImages(doc.body, assets);
  const result = doc.body.innerHTML;
  return result;
};

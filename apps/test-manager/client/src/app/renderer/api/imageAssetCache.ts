import type { AssetReadyNotice } from '@shared/types/assets';
import { buildAssetUrl } from '@shared/types/assets';
import type { GradeId } from '@shared/types/contracts';
import type { ItemState } from '@stores/useAssetCacheStore';

export type ImageDimensions = {
  width?: number;
  height?: number;
};

const validDimension = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const normalizeDimensions = (
  dimensions?: ImageDimensions | null,
): ImageDimensions => ({
  width: validDimension(dimensions?.width) ? dimensions.width : undefined,
  height: validDimension(dimensions?.height) ? dimensions.height : undefined,
});

export const mergeImageMetaState = (
  current: ItemState | undefined,
  dimensions: ImageDimensions,
): ItemState => {
  const normalized = normalizeDimensions(dimensions);
  return {
    ...(current ?? { status: 'idle' as const }),
    width: normalized.width ?? current?.width,
    height: normalized.height ?? current?.height,
  };
};

/**
 * ready 応答・通知を状態へ反映する（設計10.1）。
 * 画像本体は保持せず、readyNoticeSeq を増やして同一versionの再適用も観測できるようにする。
 */
export const mergeReadyImageState = (
  current: ItemState | undefined,
  ready: Pick<AssetReadyNotice, 'contentType' | 'version' | 'recoveryToken'> &
    ImageDimensions,
): ItemState => {
  const normalized = normalizeDimensions(ready);
  const previousSeq = current?.status === 'ready' ? current.readyNoticeSeq : 0;

  return {
    status: 'ready',
    contentType: ready.contentType,
    version: ready.version,
    recoveryToken: ready.recoveryToken,
    readyNoticeSeq: previousSeq + 1,
    width: normalized.width ?? current?.width,
    height: normalized.height ?? current?.height,
  };
};

/** ready 状態の画像を表示するための demo-asset URL を作る */
export const buildReadyAssetUrl = (
  grade: GradeId,
  key: string,
  state: Pick<AssetReadyNotice, 'version' | 'recoveryToken'>,
): string =>
  buildAssetUrl({
    grade,
    key,
    version: state.version,
    recoveryToken: state.recoveryToken,
  });

/**
 * Firestoreメタに寸法が無い場合だけ、asset URL を Image で読み込んで補完する（設計10.1）。
 */
export const readImageDimensionsFromAsset = async (asset: {
  url: string;
}): Promise<Required<ImageDimensions> | null> => {
  if (
    !asset.url ||
    typeof Image === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    let timeoutId: number | undefined;

    const complete = (dimensions: Required<ImageDimensions> | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      resolve(dimensions);
    };

    timeoutId = window.setTimeout(() => complete(null), 300);

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      complete(
        validDimension(width) && validDimension(height)
          ? { width, height }
          : null,
      );
    };
    image.onerror = () => complete(null);
    image.src = asset.url;
  });
};

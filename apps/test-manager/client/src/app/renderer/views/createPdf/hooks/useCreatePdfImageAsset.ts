// createPdf 専用の画像メタ取得 wrapper hook
// useImageMetaSubscription を grade 数値 API に合わせて薄くラップする
import { type ImageItem, useImageMetaSubscription } from '@api/imageAssetMeta';
import { useMemo } from 'react';

export type { ImageItem };

type CreatePdfImageAssetResult = {
  imageItems: ImageItem[];
  isLoadingImageMeta: boolean;
  imageMetaSignature: string;
};

const buildImageMetaSignature = (imageItems: readonly ImageItem[]): string =>
  imageItems
    .map((item) =>
      [
        item.key,
        item.width ?? '',
        item.height ?? '',
        item.objectPath ?? '',
      ].join(':'),
    )
    .sort()
    .join('|');

/** grade 数値 (1|2) を受け取り、対応する画像メタ一覧を返す薄い wrapper */
const useCreatePdfImageAsset = (grade: 1 | 2): CreatePdfImageAssetResult => {
  const gradeId = grade === 1 ? 'firstGrade' : 'secondGrade';
  const { imageItems, isLoadingImageMeta } = useImageMetaSubscription(gradeId);
  const imageMetaSignature = useMemo(
    () => buildImageMetaSignature(imageItems),
    [imageItems],
  );

  return { imageItems, isLoadingImageMeta, imageMetaSignature };
};

export default useCreatePdfImageAsset;

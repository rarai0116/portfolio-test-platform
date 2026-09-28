// 第二段階: Firestore 購読と IPC 購読を共通 hook へ移譲し、UI 射影だけを担当する (T47)
import { type ImageItem, useImageMetaSubscription } from '@api/imageAssetMeta';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';

// 後方互換のために re-export する (useImageAssetObserver などが参照)
export type { ImageItem } from '@api/imageAssetMeta';
export { kOf } from '@api/imageAssetMeta';

type ImageAssetList = {
  _imageItems: ImageItem[];
};

const useImageAssetList = (): ImageAssetList => {
  const { selectedGrade } = useSelectedIdStore();
  const { imageItems } = useImageMetaSubscription(selectedGrade);

  return {
    _imageItems: imageItems,
  };
};

export default useImageAssetList;

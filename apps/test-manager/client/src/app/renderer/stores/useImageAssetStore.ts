import type { ImageItem } from '@views/testDataEditor/hooks/useImageAssetList';
import { create } from 'zustand';

// ItemState は useAssetCacheStore へ移動。後方互換のために re-export する
export type { ItemState } from '@stores/useAssetCacheStore';

export const SortOrder = {
  createdAt_asc: 'createdAt_asc',
  createdAt_desc: 'createdAt_desc',
  updatedAt_asc: 'updatedAt_asc',
  updatedAt_desc: 'updatedAt_desc',
} as const;

export type SortOrderType = (typeof SortOrder)[keyof typeof SortOrder];

export type ImageAsset = {
  contentType?: string; // e.g. "image/png"
  /** demo-asset:// のURL。画像本体は保持しない（設計10.1） */
  url: string;
  width?: number;
  height?: number;
};

export type ImageAssetMap = Record<string, ImageAsset>;

// T47: imagesStateMap / logs はインフラ層の useAssetCacheStore へ分離した
// ここには testDataEditor 専用の UI state だけを残す
type ImageAssetState = {
  isDisplayMap: Record<string, boolean>;
  setIsDisplayMap: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
  imageItems: ImageItem[];
  setImageItems: (updater: (items: ImageItem[]) => ImageItem[]) => void;
  ignoreRequestItemKeys: string[];
  setIgnoreRequestItemKeys: (updater: (prev: string[]) => string[]) => void;
  sortOrder: SortOrderType;
  setSortOrder: (order: SortOrderType) => void;
  imageItemKeys: string[];
  setImageItemKeys: (keys: string[]) => void;
};

const useImageAssetStore = create<ImageAssetState>((set) => ({
  isDisplayMap: {},
  setIsDisplayMap: (updater) =>
    set((prev) => ({ isDisplayMap: updater(prev.isDisplayMap) })),
  imageItems: [],
  setImageItems: (updater) =>
    set((prev) => ({ imageItems: updater(prev.imageItems) })),
  ignoreRequestItemKeys: [],
  setIgnoreRequestItemKeys: (updater) =>
    set((prev) => ({
      ignoreRequestItemKeys: updater(prev.ignoreRequestItemKeys),
    })),
  sortOrder: SortOrder.updatedAt_desc,
  setSortOrder: (order) => set({ sortOrder: order }),
  imageItemKeys: [],
  setImageItemKeys: (keys) => set({ imageItemKeys: keys }),
}));

export default useImageAssetStore;

import { create } from 'zustand';

type ImageDimensionState = {
  width?: number;
  height?: number;
};

// 画像ダウンロード状態の型
export type ItemState =
  | ({ status: 'idle' } & ImageDimensionState)
  | ({ status: 'queued' } & ImageDimensionState)
  | ({
      status: 'downloading';
      transferred: number;
      total?: number;
    } & ImageDimensionState)
  | ({
      status: 'ready';
      contentType?: string;
      /** demo-asset URL の v。画像本体は保持しない（設計10.1） */
      version?: string;
      /** 表示失敗回復時に main が発行した r */
      recoveryToken?: string;
      /**
       * ready 応答・通知ごとに増やす連番。
       * 同一versionの回復通知でも React が変化を観測できるようにする。
       */
      readyNoticeSeq: number;
    } & ImageDimensionState)
  | ({ status: 'failed'; message: string } & ImageDimensionState);

type AssetCacheState = {
  imagesStateMap: Record<string, ItemState>;
  setImagesStateMap: (
    updater: (prev: Record<string, ItemState>) => Record<string, ItemState>,
  ) => void;
  logs: string[];
  setLogs: (logs: string[]) => void;
};

const useAssetCacheStore = create<AssetCacheState>((set) => ({
  imagesStateMap: {},
  setImagesStateMap: (updater) =>
    set((prev) => ({ imagesStateMap: updater(prev.imagesStateMap) })),
  logs: [],
  setLogs: (logs) => set({ logs }),
}));

export default useAssetCacheStore;

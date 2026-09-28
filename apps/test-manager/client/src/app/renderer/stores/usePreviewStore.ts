import type { PreviewResolvedPayload } from '@shared/types/preview';
import { create } from 'zustand';

type PreviewState = {
  latest?: PreviewResolvedPayload;
  setLatest: (p: PreviewResolvedPayload) => void;
  clear: () => void;
};

export const usePreviewStore = create<PreviewState>((set) => ({
  latest: undefined,
  setLatest: (p) => set({ latest: p }),
  clear: () => set({ latest: undefined }),
}));

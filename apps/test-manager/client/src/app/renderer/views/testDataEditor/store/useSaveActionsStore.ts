import type { TestData } from '@shared/types/contracts';
import { create } from 'zustand';

export type SaveRequest = {
  id: string;
  patch: Partial<TestData>;
};

export type SaveResult = {
  ok: boolean;
  error?: string;
};

type State = {
  save?: (req: SaveRequest) => Promise<SaveResult>;
  setSave: (fn: State['save']) => void;
  clearSave: () => void;
};

const useSaveActionsStore = create<State>((set) => ({
  save: undefined,
  setSave: (fn) => set({ save: fn }),
  clearSave: () => set({ save: undefined }),
}));

export default useSaveActionsStore;

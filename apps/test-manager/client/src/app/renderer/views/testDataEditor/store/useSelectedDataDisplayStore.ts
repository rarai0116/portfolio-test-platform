import type { TestDataStatus } from '@shared/types/contracts';
import { create } from 'zustand';

export type SelectedDataDisplayEntry = {
  id: string;
  name: string;
  status: TestDataStatus;
};

type SelectedDataDisplayState = {
  displayMap: Record<string, SelectedDataDisplayEntry>;
  setDisplayEntries: (entries: SelectedDataDisplayEntry[]) => void;
  updateDisplayEntry: (
    id: string,
    patch: Partial<Omit<SelectedDataDisplayEntry, 'id'>>,
  ) => void;
  clearDisplayEntries: () => void;
};

const useSelectedDataDisplayStore = create<SelectedDataDisplayState>((set) => ({
  displayMap: {},
  setDisplayEntries: (entries) =>
    set({
      displayMap: entries.reduce<Record<string, SelectedDataDisplayEntry>>(
        (accumulator, entry) => {
          accumulator[entry.id] = entry;
          return accumulator;
        },
        {},
      ),
    }),
  updateDisplayEntry: (id, patch) =>
    set((state) => {
      const current = state.displayMap[id];
      if (!current) return state;

      return {
        displayMap: {
          ...state.displayMap,
          [id]: {
            ...current,
            ...patch,
          },
        },
      };
    }),
  clearDisplayEntries: () => set({ displayMap: {} }),
}));

export default useSelectedDataDisplayStore;

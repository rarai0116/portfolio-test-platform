import { create } from 'zustand';

type GlobalLoadingItem = {
  id: string;
  message?: string;
  startedAt: number;
};

type GlobalLoadingState = {
  items: GlobalLoadingItem[];
  show: (message?: string) => string; // トークンを返す
  hide: (id: string) => void;
  setMessage: (id: string, message?: string) => void; // 追加

  clear: () => void;
};

const makeId = () =>
  `gload_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

const useGlobalLoadingStore = create<GlobalLoadingState>((set) => ({
  items: [],
  show: (message) => {
    const id = makeId();
    set((prev) => ({
      items: [...prev.items, { id, message, startedAt: Date.now() }],
    }));
    return id;
  },
  hide: (id) =>
    set((prev) => ({ items: prev.items.filter((it) => it.id !== id) })),
  setMessage: (id, message) =>
    set((prev) => ({
      items: prev.items.map((it) => (it.id === id ? { ...it, message } : it)),
    })),
  clear: () => set({ items: [] }),
}));

export default useGlobalLoadingStore;

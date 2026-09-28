import type { DockviewApi } from 'dockview-react';
import { create } from 'zustand';

type CreatePdfDockviewState = {
  // Dockview へ命令を送る参照。業務 state と分離して扱う。
  dockviewApi: DockviewApi | null;
  actions: {
    setDockviewApi: (value: DockviewApi | null) => void;
  };
};

const useCreatePdfDockviewStore = create<CreatePdfDockviewState>((set) => ({
  dockviewApi: null,
  actions: {
    setDockviewApi: (value) => set({ dockviewApi: value }),
  },
}));

export default useCreatePdfDockviewStore;
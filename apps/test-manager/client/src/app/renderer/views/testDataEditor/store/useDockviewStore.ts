import type { DockviewApi } from 'dockview-react';
import { create } from 'zustand';

type DockviewState = {
  dockviewApi: DockviewApi | null;
  setDockviewApi: (ref: DockviewApi | null) => void;
};

const useDockviewStore = create<DockviewState>((set) => ({
  dockviewApi: null,
  setDockviewApi: (ref) => set({ dockviewApi: ref }),
}));
export default useDockviewStore;

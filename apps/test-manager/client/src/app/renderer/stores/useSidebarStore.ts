import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SidebarStoreState = {
  open: boolean;
  setOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  toggleOpen: () => void;
};

export const SIDEBAR_STORE_KEY = 'ui:sidebar:v1';

const useSidebarStore = create<SidebarStoreState>()(
  persist(
    (set) => ({
      open: true,
      setOpen: (next) =>
        set((state) => ({
          open: typeof next === 'function' ? next(state.open) : next,
        })),
      toggleOpen: () =>
        set((state) => ({
          open: !state.open,
        })),
    }),
    {
      name: SIDEBAR_STORE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ open: state.open }),
    },
  ),
);

export default useSidebarStore;
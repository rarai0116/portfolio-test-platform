import { create } from "zustand";

type SizeState = {
  windowWidth: number;
  windowHeight: number;
  setWindowSize: (windowWidth: number, windowHeight: number) => void;
};

const useWindowSizeStore = create<SizeState>((set) => ({
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
  setWindowSize: (windowWidth, windowHeight) =>
    set({ windowWidth, windowHeight }),
}));

export default useWindowSizeStore;

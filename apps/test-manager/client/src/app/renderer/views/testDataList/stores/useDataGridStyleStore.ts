import type { ColumnWidths } from 'react-data-grid';
import { create } from 'zustand';
import { persist, type StorageValue } from 'zustand/middleware';

type DataGridStyleState = {
  columnWidths: ColumnWidths;
  setColumnWidths: (widths: ColumnWidths) => void;
  columnsOrder: number[];
  setColumnsOrder: (next: number[] | ((prev: number[]) => number[])) => void;
  frozenIndex: number;
  setFrozenIndex: (index: number) => void;
};

const useDataGridStyleStore = create<DataGridStyleState>()(
  persist(
    (set) => ({
      columnWidths: new Map(), //中身の幅に合わせる（仮）
      setColumnWidths: (widths) => set({ columnWidths: new Map(widths) }),
      columnsOrder: [],
      setColumnsOrder: (next) =>
        set((state) => {
          const nextOrder =
            typeof next === 'function' ? next(state.columnsOrder) : next;
          return state.columnsOrder === nextOrder
            ? {}
            : { columnsOrder: nextOrder };
        }),
      frozenIndex: 1,
      setFrozenIndex: (index) =>
        set((state) => {
          return state.frozenIndex === index ? {} : { frozenIndex: index };
        }),
    }),
    {
      name: 'dataGridStyle',
      // Mapのシリアライズ・デシリアライズ処理
      storage: {
        getItem: (name: string) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              columnWidths: new Map(
                parsed.state.columnWidths as [
                  string,
                  { type: string; width: number },
                ][],
              ),
            },
          };
        },
        setItem: (name: string, value: StorageValue<DataGridStyleState>) => {
          const str = JSON.stringify({
            ...value,
            state: {
              ...value.state,
              columnWidths: Array.from(value.state.columnWidths.entries()),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
    },
  ),
);

export default useDataGridStyleStore;

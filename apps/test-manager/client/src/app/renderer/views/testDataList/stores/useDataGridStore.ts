import type { CheckedState } from '@radix-ui/react-checkbox';
import type { GradeId } from '@shared/types/contracts';
import type {
  FilterOptions,
  FilterStateKey,
} from '@views/testDataList/types/reactGridDataTypes';
import type { SortColumn } from 'react-data-grid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 浅い比較ユーティリティ（フィルタ用）
function shallowEqualObj<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;

  const ak = Object.keys(a) as Array<keyof T>;
  const bk = Object.keys(b) as Array<keyof T>;

  if (ak.length !== bk.length) return false;

  for (const k of ak) {
    if (!(k in b)) return false;
    if (a[k] !== (b as T)[k]) return false;
  }
  return true;
}

// ソート配列の同値判定
function isSameSort(a: SortColumn[], b: SortColumn[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].columnKey !== b[i].columnKey || a[i].direction !== b[i].direction)
      return false;
  }
  return true;
}

type DataGridState = {
  grade: GradeId;
  setGrade: (grade: GradeId) => void;
  filterSelectionInitialized: boolean;
  setFilterSelectionInitialized: (initialized: boolean) => void;
  // 変更: フィルタは既存のまま
  checkedFilters: FilterOptions;
  // 変更: 部分更新/関数更新対応＋同値早期return
  setCheckedFilters: (
    next:
      | Partial<FilterOptions>
      | ((prev: FilterOptions) => Partial<FilterOptions>),
  ) => void;
  // 単一キー更新（最小限の変更で参照揺れを抑える）
  updateFilter: (
    key: FilterStateKey,
    value: string,
    checked: CheckedState,
  ) => void;
  clearFilters: () => void;

  // ソート
  sortColumns: SortColumn[];
  // 変更: 同値早期return
  setSortColumns: (columns: SortColumn[]) => void;
  // 既存の「後勝ちユニーク化」ロジックをストア側で提供
  setSortColumnsUnique: (columns: SortColumn[]) => void;
  //ターゲットの右側の要素をハイライトするためのIndex
  dragHighLightIndex: number | null;
  setDragHighLightIndex: (id: number | null) => void;
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
};

const initialFilters: FilterOptions = {
  year: [],
  publicationYear: [],
  subject: [],
  bigCategory: [],
  smallCategory: [],
  otherTags: [],
  original: [],
  autoCheck: [],
  shuffleable: [],
  convertibleQaa: [],
  answerFormat: [],
  manualCheck: [],
  status: [],
};

const useDataGridStore = create<DataGridState>()(
  persist(
    (set) => ({
      grade: 'firstGrade',
      setGrade: (grade) =>
        set((state) => (state.grade === grade ? {} : { grade })),
      filterSelectionInitialized: false,
      setFilterSelectionInitialized: (initialized) =>
        set((state) =>
          state.filterSelectionInitialized === initialized
            ? {}
            : { filterSelectionInitialized: initialized },
        ),
      checkedFilters: initialFilters,

      setCheckedFilters: (next) =>
        set((state) => {
          const patch =
            typeof next === 'function' ? next(state.checkedFilters) : next;
          const merged = {
            ...initialFilters,
            ...state.checkedFilters,
            ...patch,
          };
          return shallowEqualObj(state.checkedFilters, merged)
            ? {}
            : { checkedFilters: merged };
        }),

      updateFilter: (key, value, checked) =>
        set((state) => {
          const currentValues = state.checkedFilters[key] ?? [];

          if (checked) {
            if (currentValues.includes(value)) {
              return {};
            }

            return {
              checkedFilters: {
                ...initialFilters,
                ...state.checkedFilters,
                [key]: [...currentValues, value],
              } as FilterOptions,
            };
          }

          const newArray = currentValues.filter((v) => v !== value);
          if (
            currentValues.length === newArray.length &&
            currentValues.every((v, index) => v === newArray[index])
          ) {
            return {};
          }

          return {
            checkedFilters: {
              ...initialFilters,
              ...state.checkedFilters,
              [key]: newArray,
            } as FilterOptions,
          };
        }),

      clearFilters: () =>
        set((state) =>
          shallowEqualObj(state.checkedFilters, initialFilters)
            ? {}
            : { checkedFilters: initialFilters },
        ),

      sortColumns: [],

      setSortColumns: (columns) =>
        set((state) =>
          isSameSort(state.sortColumns, columns)
            ? {}
            : { sortColumns: columns },
        ),

      setSortColumnsUnique: (columns) =>
        set((state) => {
          const merged = [...state.sortColumns, ...columns].reduceRight<
            SortColumn[]
          >((acc, cur) => {
            if (!acc.find((s) => s.columnKey === cur.columnKey)) {
              acc.unshift(cur);
            }
            return acc;
          }, []);

          return isSameSort(state.sortColumns, merged)
            ? {}
            : { sortColumns: merged };
        }),

      dragHighLightIndex: null,

      setDragHighLightIndex: (id) =>
        set((state) =>
          state.dragHighLightIndex === id ? {} : { dragHighLightIndex: id },
        ),

      selectedRows: new Set<string>(),

      setSelectedRows: (rows) =>
        set((state) => {
          const areSetsEqual =
            state.selectedRows.size === rows.size &&
            [...state.selectedRows].every((value) => rows.has(value));

          return areSetsEqual ? {} : { selectedRows: rows };
        }),
    }),
    {
      name: 'testDataListDataGrid',
      partialize: (state) => ({
        grade: state.grade,
        filterSelectionInitialized: state.filterSelectionInitialized,
        checkedFilters: state.checkedFilters,
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as
          | Partial<DataGridState>
          | undefined;

        return {
          ...currentState,
          ...typedPersistedState,
          filterSelectionInitialized:
            typedPersistedState?.filterSelectionInitialized ?? false,
          checkedFilters: {
            ...initialFilters,
            ...(typedPersistedState?.checkedFilters ?? {}),
          },
        };
      },
    },
  ),
);

export default useDataGridStore;

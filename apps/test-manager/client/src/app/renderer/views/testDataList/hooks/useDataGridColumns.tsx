import AutoCheckPill from '@parts/autoCheckPill';
import ManualCheckPill from '@parts/manualCheckPill';
import StatusPill, { statusKindMap } from '@parts/statusPill';
import type { TestData, Version } from '@shared/types/contracts';
import useDataGridFilter from '@views/testDataList/hooks/useDataGridFilter';
import HeaderCell from '@views/testDataList/organisms/headerCell';
import CustomCheckBox from '@views/testDataList/parts/customCheckBox';
import CustomHeaderCheckBox from '@views/testDataList/parts/customHeaderCheckBox';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import type {
  FilterOptions,
  FilterStateKey,
  Row,
} from '@views/testDataList/types/reactGridDataTypes';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type Column,
  type RenderHeaderCellProps,
  SelectColumn,
  type SortColumn,
  type SortDirection,
} from 'react-data-grid';
import { useShallow } from 'zustand/react/shallow';
import AnswerFormatPill from '../parts/answerFormatPill';
import OtherTagsCell from '../parts/otherTagsCell';

// 列コンフィグ型 (型ごとに項目を追加する場合はここを編集)
type ColumnSpec<R> = {
  // key は string に絞る
  key: Extract<keyof R, string>;
  filterKey?: FilterStateKey;
  allowSort?: boolean;
  // name は Column の定義と同じ型にする（string | ReactElement）
  name: Column<R>['name'];
  minWidth?: number;
  frozen?: boolean;
  sortable?: boolean;
  draggable?: boolean;
  headerCellClass?: string;
  cellClass?: string;
  renderCell?: Column<R>['renderCell'];
  // 戻り値は ReactElement に統一
  renderHeaderCell?: (
    p: RenderHeaderCellProps<R, unknown>,
  ) => React.ReactElement;
};

const SELECT_COL_MIN_WIDTH = 72;

// 列設定（列を追加する場合はここを編集）
const COLUMN_SPECS: ReadonlyArray<ColumnSpec<Row>> = [
  {
    key: 'no',
    name: 'No',
    minWidth: 72,
    draggable: false,
  },
  {
    key: 'original',
    filterKey: 'original',
    name: (
      <div className="text-center flex flex-col gap-0.5">
        <p>問題</p>
        <p>種別</p>
      </div>
    ),
    minWidth: 90,
  },
  {
    key: 'year',
    filterKey: 'year',
    name: '年',
    minWidth: 65,
  },

  { key: 'subject', filterKey: 'subject', name: '科目', minWidth: 70 },
  {
    key: 'bigCategory',
    filterKey: 'bigCategory',
    name: '大分類',
    minWidth: 90,
    cellClass: 'cell-text-left',
  },
  {
    key: 'smallCategory',
    filterKey: 'smallCategory',
    name: '小分類',
    minWidth: 90,
    cellClass: 'cell-text-left',
  },
  { key: 'theme', name: 'テーマ', minWidth: 90, cellClass: 'cell-text-left' },
  {
    key: 'publicationYear',
    filterKey: 'publicationYear',
    name: '出版年',
    minWidth: 90,
  },
  {
    key: 'publicationNo',
    name: '資料No',
    minWidth: 90,
  },
  {
    key: 'testNo',
    name: (
      <div className="text-center flex flex-col gap-0.5">
        <p>問題</p>
        <p>番号</p>
      </div>
    ),
    minWidth: 70,
  },
  {
    key: 'status',
    filterKey: 'status',
    name: '状態',
    minWidth: 80,
    renderCell: ({ row }) => (
      <StatusPill kind={statusKindMap[row.status] ?? 'unknown'} />
    ),
  },

  {
    key: 'manualCheck',
    filterKey: 'manualCheck',
    name: (
      <div className="text-center flex flex-col gap-0.5">
        <p>校正</p>
        <p>ロック</p>
      </div>
    ),
    minWidth: 110,
    renderCell: ({ row }) => <ManualCheckPill value={row.manualCheck} />,
  },
  {
    key: 'autoCheck',
    filterKey: 'autoCheck',
    name: (
      <div className="text-center flex flex-col gap-0.5">
        <p>自動</p>
        <p>チェック</p>
      </div>
    ),
    minWidth: 110,
    renderCell: ({ row }) => <AutoCheckPill value={row.autoCheck} />,
  },
  {
    key: 'shuffleable',
    filterKey: 'shuffleable',
    name: 'シャッフル',
    minWidth: 110,
    renderCell: ({ row }) => (
      <div className="flex items-center justify-center text-base leading-none text-foreground">
        {row.shuffleable}
      </div>
    ),
  },
  {
    key: 'convertibleQaa',
    filterKey: 'convertibleQaa',
    name: (
      <div className="text-center flex flex-col gap-0.5">
        <p>一問</p>
        <p>一答化</p>
      </div>
    ),
    minWidth: 100,
    renderCell: ({ row }) => (
      <div className="flex items-center justify-center text-base leading-none text-foreground">
        {row.convertibleQaa}
      </div>
    ),
  },
  {
    key: 'answerFormat',
    filterKey: 'answerFormat',
    name: '形式',
    minWidth: 100,
    renderCell: ({ row }) => <AnswerFormatPill value={row.answerFormat} />,
  },
  {
    key: 'otherTags',
    filterKey: 'otherTags',
    allowSort: false,
    sortable: false,
    name: 'タグ',
    minWidth: 60,
    renderCell: ({ row }) => <OtherTagsCell tags={row.otherTags} />,
  },

  {
    key: 'lastUpdated',
    name: '最終更新日',
    minWidth: 120,
  },
];

type GridDataColumns = {
  initialColumnsOrder: number[];
  reorderedColumns: Column<Row, unknown>[];
  onColumnsReorder: (sourceKey: string, targetKey: string) => void;
};

const modeMatchesStatus = (
  status: unknown,
  mode: Exclude<SelectionMode, null>,
): boolean => {
  return mode === 'stopped'
    ? isStoppedStatus(status)
    : !isStoppedStatus(status);
};

type SelectionMode = 'stopped' | 'notStopped' | null;
const isStoppedStatus = (v: unknown): boolean => v === '停止中';

const isSameColumnsOrder = (a: number[], b: number[]) => {
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

/**カラム定義の生成と並び替え管理 */
const useDataGridColumns = (
  docs: {
    path: string;
    data?: TestData | undefined;
    updateTime: Version;
  }[],
  rows: Row[],
  loading: boolean,
): GridDataColumns => {
  const {
    updateFilter,
    sortColumns,
    setSortColumns,
    setDragHighLightIndex,
    selectedRows,
    setSelectedRows,
  } = useDataGridStore(
    useShallow((s) => ({
      grade: s.grade,
      updateFilter: s.updateFilter,
      sortColumns: s.sortColumns,
      setSortColumns: s.setSortColumns,
      setDragHighLightIndex: s.setDragHighLightIndex,
      selectedRows: s.selectedRows,
      setSelectedRows: s.setSelectedRows,
    })),
  );
  const { frozenIndex, columnsOrder, setColumnsOrder } = useDataGridStyleStore(
    useShallow((s) => ({
      frozenIndex: s.frozenIndex,
      columnsOrder: s.columnsOrder,
      setColumnsOrder: s.setColumnsOrder,
    })),
  );

  const { filterOptions } = useDataGridFilter(docs, loading);

  const statusByPath = useMemo(() => {
    return new Map(docs.map((d) => [d.path, d.data?.status]));
  }, [docs]);

  const selectionMode = useMemo<SelectionMode>(() => {
    const first = selectedRows.values().next().value as string | undefined;
    if (!first) return null;
    const status = statusByPath.get(first);
    return isStoppedStatus(status) ? 'stopped' : 'notStopped';
  }, [selectedRows, statusByPath]);

  const selectStopPropagation = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.stopPropagation();
      }
    },
    [],
  );

  const isSameSort = useCallback(
    (a: SortColumn[], b: SortColumn[]) =>
      a.length === b.length &&
      a.every(
        (x, i) =>
          x.columnKey === b[i].columnKey && x.direction === b[i].direction,
      ),
    [],
  );

  //昇順・降順の切り替え
  const onSortColumns = useCallback(
    (clickedKey: string, direction: SortDirection) => {
      const sortCol = [...sortColumns];
      sortCol.push({ columnKey: clickedKey, direction });

      // 重複した列は後ろのもの(新しく追加されたもの)のみ残す
      const uniqueSortCol = sortCol.reduceRight<SortColumn[]>(
        //右から処理
        (acc, current) => {
          const updatedCurrent: SortColumn = current;

          if (!acc.find((s) => s.columnKey === updatedCurrent.columnKey)) {
            //なければ追加
            acc.unshift(updatedCurrent); //先頭に追加
          }
          return acc;
        },
        [],
      );

      if (isSameSort(sortColumns, uniqueSortCol)) return; // 変化なしなら更新しない
      setSortColumns(uniqueSortCol);
    },
    [setSortColumns, sortColumns, isSameSort],
  );

  //子要素への移動を判定するフラグ（ちらつき防止）
  const innerFlagRef = useRef(false);

  // ドラッグ関連のプロパティ
  const dragProps = useMemo(() => {
    return {
      onDragEnter: (_event: React.DragEvent<HTMLDivElement>, idx: number) => {
        innerFlagRef.current = true;
        setDragHighLightIndex(idx + 1); // 右隣の列をハイライトするために idx + 1 をセット
      },
      onDragOver: (_event: React.DragEvent<HTMLDivElement>) => {
        innerFlagRef.current = false;
      },
      onDragLeave: (_event: React.DragEvent<HTMLDivElement>) => {
        if (innerFlagRef.current) {
          // フラグがセットされている場合は、子要素間の移動なので無視
          innerFlagRef.current = false;
        } else {
          // 本当に外に出たのでnullにする
          setDragHighLightIndex(null);
        }
      },
      onDrop: (_event: React.DragEvent<HTMLDivElement>) => {
        setDragHighLightIndex(null);
      },
    };
  }, [setDragHighLightIndex]);

  // フィルタ有無に応じて HeaderCell を作るヘルパー
  const mkRenderHeader = useCallback(
    (filterKey?: keyof FilterOptions, allowSort?: boolean) =>
      (p: RenderHeaderCellProps<Row, unknown>) => {
        return (
          <HeaderCell
            {...p}
            allowSort={allowSort}
            onSortColumns={onSortColumns}
            dragProps={dragProps}
            selectStopPropagation={selectStopPropagation}
            {...(filterKey
              ? {
                  onCheckedChange: updateFilter,
                  filterOption: filterOptions[filterKey],
                }
              : {})}
          />
        );
      },
    [
      filterOptions,
      selectStopPropagation,
      updateFilter,
      dragProps,
      onSortColumns,
    ],
  );

  // カラム定義
  const columns = useMemo<Column<Row, unknown>[]>(() => {
    return [
      {
        ...SelectColumn,
        minWidth: SELECT_COL_MIN_WIDTH,
        renderHeaderCell: () => (
          <CustomHeaderCheckBox
            rows={rows}
            selectionMode={selectionMode}
            selectedRows={selectedRows}
            setSelectedRows={setSelectedRows}
          />
        ),
        renderCell: ({ row }: { row: Row }) => (
          <CustomCheckBox
            row={row}
            isDisabled={
              selectionMode !== null &&
              !modeMatchesStatus(row.status, selectionMode)
            }
          />
        ),
      },
      ...COLUMN_SPECS.map((spec) => {
        return {
          key: spec.key,
          name: spec.name,
          minWidth: spec.minWidth,
          sortable: spec.sortable,
          cellClass: spec.cellClass,
          renderCell: spec.renderCell,
          renderHeaderCell: mkRenderHeader(spec.filterKey, spec.allowSort),
        };
      }),
    ];
  }, [mkRenderHeader, rows, selectionMode, selectedRows, setSelectedRows]);

  const validColumnIndexes = useMemo(() => {
    return columns.map((_, index) => index);
  }, [columns]);

  const normalizeColumnsOrder = useCallback(
    (currentColumnsOrder: number[]) => {
      const validColumnIndexSet = new Set(validColumnIndexes);
      const seen = new Set<number>();
      const normalized = [0, ...currentColumnsOrder].filter((index) => {
        if (!validColumnIndexSet.has(index) || seen.has(index)) {
          return false;
        }

        seen.add(index);
        return true;
      });

      const missing = validColumnIndexes.filter((index) => !seen.has(index));
      return [...normalized, ...missing];
    },
    [validColumnIndexes],
  );

  // 初期化
  const initialColumnsOrder: number[] = useMemo(() => {
    return validColumnIndexes;
  }, [validColumnIndexes]);

  const normalizedColumnsOrder = useMemo(() => {
    return normalizeColumnsOrder(columnsOrder);
  }, [columnsOrder, normalizeColumnsOrder]);

  useEffect(() => {
    if (!isSameColumnsOrder(columnsOrder, normalizedColumnsOrder)) {
      setColumnsOrder(normalizedColumnsOrder);
    }
  }, [columnsOrder, normalizedColumnsOrder, setColumnsOrder]);

  //カラムの並び順変更
  const reorderedColumns = useMemo(() => {
    return normalizedColumnsOrder.map((colIndex, i) => {
      return {
        ...columns[colIndex],
        frozen: i <= frozenIndex,
        draggable: !(i <= frozenIndex), // frozen列はドラッグ不可
      };
    });
  }, [normalizedColumnsOrder, columns, frozenIndex]);

  const onColumnsReorder = useCallback(
    (sourceKey: string, targetKey: string) => {
      setColumnsOrder((columnsOrder: number[]) => {
        const currentColumnsOrder = normalizeColumnsOrder(columnsOrder);

        const sourceIndex = currentColumnsOrder.findIndex(
          (index) => columns[index].key === sourceKey,
        );
        const targetIndex = currentColumnsOrder.findIndex(
          (index) => columns[index].key === targetKey,
        );
        if (sourceIndex < 0 || targetIndex < 0) {
          return currentColumnsOrder;
        }

        const sourceOrder = currentColumnsOrder[sourceIndex];
        // 削除
        const newOrder = currentColumnsOrder.toSpliced(sourceIndex, 1);
        // 挿入
        if (sourceIndex < targetIndex) {
          newOrder.splice(targetIndex, 0, sourceOrder);
        } else {
          newOrder.splice(targetIndex + 1, 0, sourceOrder);
        }

        return newOrder;
      });
    },
    [columns, normalizeColumnsOrder, setColumnsOrder],
  );

  return {
    initialColumnsOrder,
    reorderedColumns,
    onColumnsReorder,
  };
};

export default useDataGridColumns;

import type { TestData, Version } from '@shared/types/contracts';
import {
  areAllFilterOptionsSelected,
  filterValuesByOptions,
} from '@views/testDataList/api/filterSelection';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import {
  answerFormatDisplay,
  autoCheckDisplay,
  booleanMarkDisplay,
  type FilterStateKey,
  filterKeys,
  manualCheckDisplay,
  originalDisplay,
  type Row,
} from '@views/testDataList/types/reactGridDataTypes';
import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

type GridDataRows = {
  filteredAndSortedRows: Row[];
};

const displayValue = (v: string | undefined) =>
  v && v.trim().length > 0 ? v : '_入力なし';

const normalizeOtherTags = (tags: string[] | undefined): string[] => {
  if (!tags) return [];

  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return [...new Set(normalized)];
};

const matchesFilter = (
  row: Row,
  key: FilterStateKey,
  selectedValues: Set<string> | null,
): boolean => {
  if (selectedValues === null) {
    return true;
  }

  if (selectedValues.size === 0) return false;

  if (key === 'otherTags') {
    return row.otherTags.some((value) => selectedValues.has(value));
  }

  return selectedValues.has(row[key] as string);
};

/* 行データの生成、フィルター、ソート処理 */
const useDataGridRows = (
  docs: {
    path: string;
    data?: TestData | undefined;
    updateTime: Version;
  }[],
): GridDataRows => {
  const { checkedFilters, sortColumns } = useDataGridStore(
    useShallow((s) => ({
      checkedFilters: s.checkedFilters,
      sortColumns: s.sortColumns,
    })),
  );

  // rowのキャッシュ
  const rowCacheRef = useRef<Map<string, { v: string; row: Row }>>(new Map());

  const rows = useMemo(() => {
    const cache = rowCacheRef.current;
    const mkVer = (t: Version) => `${t.seconds}:${t.nanos}`;

    const list: Row[] = docs
      .map((doc) => {
        const data = doc.data;
        if (!data) return undefined;

        const key = doc.path; // ユニークな行キーとして使用
        const ver = mkVer(doc.updateTime);
        const cached = cache.get(key);
        if (cached?.v === ver) return cached.row;

        const row: Row = {
          id: key,
          no: data.no,
          year: data.nengo + data.year,
          publicationYear: data.publicationYear ?? '',
          publicationNo: data.publicationNo ?? '',
          subject: data.subject,
          bigCategory: displayValue(data.bigCategoryTag),
          smallCategory: displayValue(data.smallCategoryTag),
          theme: displayValue(data.themeTag),
          otherTags: normalizeOtherTags(data.otherTags),
          testNo: data.testNo,
          status: data.status,
          original: data.isOriginal
            ? originalDisplay.true
            : originalDisplay.false,
          autoCheck: data.autoCheck
            ? autoCheckDisplay.true
            : autoCheckDisplay.false,
          shuffleable: data.isShuffleable
            ? booleanMarkDisplay.true
            : booleanMarkDisplay.false,
          convertibleQaa: data.isConvertibleQaa
            ? booleanMarkDisplay.true
            : booleanMarkDisplay.false,
          answerFormat: data.isNegativeAnswer
            ? answerFormatDisplay.incorrect
            : answerFormatDisplay.correct,
          manualCheck: data.calibrationCheck
            ? manualCheckDisplay.lock
            : manualCheckDisplay.unlock,
          // updatedAtがない場合は'ー'を表示 ある場合は、YYYY/MM/DD HH:mm形式で表示
          lastUpdated: data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000).toLocaleString()
            : 'ー',
        };
        cache.set(key, { v: ver, row });
        return row;
      })
      .filter((row): row is Row => row !== undefined);

    return list.toSorted((a, b) => Number(a.no) - Number(b.no));
  }, [docs]);

  const filteredRows = useMemo(() => {
    const availableFilterOptions = Object.fromEntries(
      filterKeys.map((key) => {
        if (key === 'otherTags') {
          return [key, [...new Set(rows.flatMap((row) => row.otherTags))]];
        }

        return [key, [...new Set(rows.map((row) => row[key] as string))]];
      }),
    ) as Record<FilterStateKey, string[]>;

    const effectiveFilters = Object.fromEntries(
      filterKeys.map((key) => {
        const options = availableFilterOptions[key];
        const selectedValues = filterValuesByOptions(
          checkedFilters[key] ?? [],
          options,
        );

        if (options.length === 0) {
          return [key, null];
        }

        if (areAllFilterOptionsSelected(selectedValues, options)) {
          return [key, null];
        }

        return [key, new Set(selectedValues)];
      }),
    ) as Record<FilterStateKey, Set<string> | null>;

    return rows.filter((r) => {
      if (!r) return false;

      return filterKeys.every((key) =>
        matchesFilter(r, key, effectiveFilters[key]),
      );
    });
  }, [rows, checkedFilters]);

  const collator = useMemo(
    () =>
      new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    [],
  );

  const filteredAndSortedRows = useMemo(() => {
    if (sortColumns.length === 0) return filteredRows;

    // 最初にクリックした列を最優先にするため、逆順で評価する
    // 例) Cを先に、Bを後にクリック => sortColumns: [C, B]
    // priority: [C, B]（先にクリックしたCを先に評価）
    const priority = sortColumns.slice().reverse();

    // タイブレーク用に現在の並び順のインデックスを記録（安定性の担保）
    const indexMap = new Map(
      filteredRows.map((row, idx) => [row.id ?? row.no, idx]),
    );

    return filteredRows.toSorted((a, b) => {
      for (const sort of priority) {
        const columnKey = sort.columnKey as keyof Row;
        const direction = sort.direction;

        const av = a[columnKey];
        const bv = b[columnKey];

        let comparison = 0;
        if (typeof av === 'string' && typeof bv === 'string') {
          comparison = collator.compare(String(av), String(bv));
        } else if (typeof av === 'number' && typeof bv === 'number') {
          comparison = av - bv;
        } else {
          // 混在型の保険
          comparison = String(av).localeCompare(String(bv));
        }

        if (comparison !== 0) {
          return direction === 'ASC' ? comparison : -comparison;
        }
      }

      // すべて同じなら元の並び順を維持（安定ソート）
      const ka = a.id ?? a.no;
      const kb = b.id ?? b.no;
      return (indexMap.get(ka) ?? 0) - (indexMap.get(kb) ?? 0);
    });
  }, [filteredRows, sortColumns, collator]);

  return {
    filteredAndSortedRows,
  };
};

export default useDataGridRows;

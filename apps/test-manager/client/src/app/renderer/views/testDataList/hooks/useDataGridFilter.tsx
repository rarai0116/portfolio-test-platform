import type { TestData, Version } from '@shared/types/contracts';
import { normalizeCheckedFilterValues } from '@views/testDataList/api/filterSelection';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import {
  answerFormatDisplay,
  autoCheckDisplay,
  booleanMarkDisplay,
  type FilterOptions,
  type FilterStateKey,
  filterKeys,
  manualCheckDisplay,
  originalDisplay,
} from '@views/testDataList/types/reactGridDataTypes';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

// 配列・項目比較のユーティリティ（参照安定化のため）
const equalOptions = (a: string[], b: string[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const equalFilterItems = (a: FilterOptions, b: FilterOptions) => {
  return filterKeys.every((key) => equalOptions(a[key], b[key]));
};

type GridDataFilter = {
  filterOptions: FilterOptions;
};

const displayValue = (v: string | undefined) =>
  v && v.trim().length > 0 ? v : '_入力なし';

const stoppedStatus = '停止中';

const normalizeDefaultCheckedFilterValues = (args: {
  key: FilterStateKey;
  selectedValues: string[];
  options: string[];
  initializeEmptyAsAll: boolean;
}): string[] => {
  const normalized = normalizeCheckedFilterValues(args);

  if (args.initializeEmptyAsAll && args.key === 'status') {
    return normalized.filter((value) => value !== stoppedStatus);
  }

  return normalized;
};

/**フィルターオプションの生成と選択済みフィルターの同期 */
const useDataGridFilter = (
  docs: {
    path: string;
    data?: TestData | undefined;
    updateTime: Version;
  }[],
  loading: boolean,
): GridDataFilter => {
  const {
    checkedFilters,
    filterSelectionInitialized,
    setCheckedFilters,
    setFilterSelectionInitialized,
    grade,
    //    clearFilters,
  } = useDataGridStore(
    useShallow((s) => ({
      checkedFilters: s.checkedFilters,
      filterSelectionInitialized: s.filterSelectionInitialized,
      setCheckedFilters: s.setCheckedFilters,
      setFilterSelectionInitialized: s.setFilterSelectionInitialized,
      grade: s.grade,
      clearFilters: s.clearFilters,
    })),
  );

  const filterOptionsRef = useRef<FilterOptions | null>(null);
  const filterOptions = useMemo<FilterOptions>(() => {
    const sets = Object.fromEntries(
      filterKeys.map((key) => [key, new Set<string>()]),
    ) as Record<FilterStateKey, Set<string>>;

    for (const doc of docs) {
      const data = doc.data;
      if (!data) continue;

      // 年は "令和7" のように nengo + year
      sets.year.add(String(data.nengo) + String(data.year));
      sets.publicationYear.add(String(data.publicationYear ?? ''));
      sets.subject.add(String(data.subject));
      sets.bigCategory.add(displayValue(data.bigCategoryTag));
      sets.smallCategory.add(displayValue(data.smallCategoryTag));
      for (const tag of data.otherTags ?? []) {
        const normalizedTag = tag.trim();
        if (!normalizedTag) continue;
        sets.otherTags.add(normalizedTag);
      }
      sets.original.add(
        data.isOriginal ? originalDisplay.true : originalDisplay.false,
      );
      sets.autoCheck.add(
        data.autoCheck ? autoCheckDisplay.true : autoCheckDisplay.false,
      );
      sets.shuffleable.add(
        data.isShuffleable ? booleanMarkDisplay.true : booleanMarkDisplay.false,
      );
      sets.convertibleQaa.add(
        data.isConvertibleQaa
          ? booleanMarkDisplay.true
          : booleanMarkDisplay.false,
      );
      sets.answerFormat.add(
        data.isNegativeAnswer
          ? answerFormatDisplay.incorrect
          : answerFormatDisplay.correct,
      );
      sets.manualCheck.add(
        data.calibrationCheck
          ? manualCheckDisplay.lock
          : manualCheckDisplay.unlock,
      );
      sets.status.add(String(data.status));
    }

    // 並び順
    const collator = new Intl.Collator('ja', {
      numeric: true,
      sensitivity: 'base',
    });

    const next = Object.fromEntries(
      filterKeys.map((key) => {
        let arr = Array.from(sets[key]).sort((a, b) => collator.compare(a, b));
        if (key === 'year') {
          arr = arr.reverse(); // 新しい年を先頭に
        }
        return [key, arr];
      }),
    ) as FilterOptions;

    const prev = filterOptionsRef.current;
    if (prev && equalFilterItems(prev, next)) {
      return prev; // 変更なし → 参照再利用
    }
    filterOptionsRef.current = next;
    return next;
  }, [docs]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setCheckedFiltersは依存配列には含めない
  useEffect(() => {
    if (loading) return; // ローディング中はフィルターの同期を行わない
    if (docs.length === 0) return; // 問題0件（空データ）は同期対象なしのためスキップ（docs[0] undefined 参照の白画面クラッシュを防ぐ）
    if (!docs[0].path.includes(grade)) return; // ドキュメントの級が現在の級と合致しない場合はフィルターの同期を行わない（級が切り替わった直後など）
    const shouldInitializeEmptyAsAll = !filterSelectionInitialized;
    const nextCheckedFilters = Object.fromEntries(
      filterKeys.map((key) => {
        return [
          key,
          normalizeDefaultCheckedFilterValues({
            key,
            selectedValues: checkedFilters[key] ?? [],
            options: filterOptions[key],
            initializeEmptyAsAll: shouldInitializeEmptyAsAll,
          }),
        ];
      }),
    ) as FilterOptions;

    if (!equalFilterItems(checkedFilters, nextCheckedFilters)) {
      setCheckedFilters(nextCheckedFilters);
    }

    if (shouldInitializeEmptyAsAll) {
      setFilterSelectionInitialized(true);
    }
  }, [
    checkedFilters,
    filterOptions,
    filterSelectionInitialized,
    loading,
    grade,
  ]);

  return {
    filterOptions,
  };
};

export default useDataGridFilter;

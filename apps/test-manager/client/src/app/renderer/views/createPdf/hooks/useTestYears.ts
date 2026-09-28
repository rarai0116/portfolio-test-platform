import {
  deriveSelectedYearNos,
  deriveYearFilterOptions,
} from '@views/createPdf/api/createPdfDerivedInputs';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

/** 初期表示する最大年数（null 時の先頭 N 件） */
export const DEFAULT_SELECTED_YEAR_LIMIT = 11;

export const getDefaultSelectedYears = (
  sortedLabels: readonly string[],
): string[] => sortedLabels.slice(0, DEFAULT_SELECTED_YEAR_LIMIT);

export type UseTestYearsInput = {
  selectedYears: string[] | null;
  onSelectedYearsChange: (value: string[] | null) => void;
};

export type UseTestYearsOutput = {
  /** ソート済みラベル一覧 */
  sortedLabels: string[];
  // nosMap は内部計算用。外部には公開しない
  /** UI 表示用の実効選択年（null の場合は先頭11件を返すが store は更新しない） */
  effectiveSelectedYears: string[];
  /** null = 全年対象（フィルタなし）。Set = 対象 nos の集合 */
  selectedYearNos: ReadonlySet<number> | null;
  isLoadingTestData: boolean;
  onSelectedYearsChange: (value: string[] | null) => void;
};

export function useTestYears(input: UseTestYearsInput): UseTestYearsOutput {
  const { isLoadingTestData, testDataByNo } = useCreatePdfResourceStore(
    useShallow((s) => ({
      isLoadingTestData: s.testData.isLoading,
      testDataByNo: s.testData.maps.byNo,
    })),
  );

  const yearFilterOptions = useMemo(
    () => deriveYearFilterOptions(testDataByNo),
    [testDataByNo],
  );
  const sortedLabels = yearFilterOptions.sortedLabels;

  // selectedYears === null かつラベルが揃っている場合は先頭 N 件を表示（store 更新なし）
  const effectiveSelectedYears = useMemo(() => {
    if (input.selectedYears !== null) return input.selectedYears;
    return getDefaultSelectedYears(sortedLabels);
  }, [input.selectedYears, sortedLabels]);

  useEffect(() => {
    if (isLoadingTestData || input.selectedYears !== null) return;
    const defaultYears = getDefaultSelectedYears(sortedLabels);
    if (defaultYears.length === 0) return;
    input.onSelectedYearsChange(defaultYears);
  }, [
    input.selectedYears,
    input.onSelectedYearsChange,
    isLoadingTestData,
    sortedLabels,
  ]);

  // データ未ロード中は全件対象（フィルタなし）として扱う
  const selectedYearNos = useMemo<ReadonlySet<number> | null>(() => {
    if (isLoadingTestData || input.selectedYears === null) return null;
    return deriveSelectedYearNos(testDataByNo, input.selectedYears);
  }, [isLoadingTestData, input.selectedYears, testDataByNo]);

  return {
    sortedLabels,
    effectiveSelectedYears,
    selectedYearNos,
    isLoadingTestData,
    onSelectedYearsChange: input.onSelectedYearsChange,
  };
}

import {
  mockCheckedFilters,
  mockTestDocs,
} from '@renderer/mocks/mockTestDataList';
import { act, renderHook } from '@testing-library/react';
import useDataGridFilter from '@views/testDataList/hooks/useDataGridFilter';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import type { Row } from '@views/testDataList/types/reactGridDataTypes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDataGridColumns from './useDataGridColumns';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataList/stores/useDataGridStyleStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataList/hooks/useDataGridFilter', () => ({
  default: vi.fn(),
}));

describe('useDataGridColumns', () => {
  const setSortColumns = vi.fn();
  const setColumnsOrder = vi.fn();
  const setSelectedRows = vi.fn();
  const rows: Row[] = [];
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue({
      updateFilter: vi.fn(),
      sortColumns: [],
      setSortColumns,
      setDragHighLightIndex: vi.fn(),
      selectedRows: new Set<string>(),
      setSelectedRows,
    });
    vi.mocked(useDataGridStyleStore).mockReturnValue({
      frozenIndex: 0,
      columnsOrder: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
      ],
      setColumnsOrder,
    });
    vi.mocked(useDataGridFilter).mockReturnValue({
      filterOptions: mockCheckedFilters,
    });
  });

  it('onColumnsReorderが正しく動作する', () => {
    const { result } = renderHook(() =>
      useDataGridColumns(mockTestDocs, rows, false),
    );

    act(() => {
      result.current.onColumnsReorder('no', 'year');
    });
    expect(setColumnsOrder).toHaveBeenCalledTimes(1);
  });

  it('reorderedColumnsが正しく生成される', () => {
    const { result } = renderHook(() =>
      useDataGridColumns(mockTestDocs, rows, false),
    );
    const { reorderedColumns } = result.current;

    expect(reorderedColumns).toHaveLength(19);

    expect(reorderedColumns[1].key).toBe('no');
    expect(reorderedColumns[2].key).toBe('original');
    expect(reorderedColumns[8].key).toBe('publicationYear');
    expect(reorderedColumns[9].key).toBe('publicationNo');
    expect(reorderedColumns[14].key).toBe('shuffleable');
    expect(reorderedColumns[15].key).toBe('convertibleQaa');
    expect(reorderedColumns[16].key).toBe('answerFormat');
  });

  it('保存済みの列順に新規列が不足していても補完される', () => {
    vi.mocked(useDataGridStyleStore).mockReturnValue({
      frozenIndex: 0,
      columnsOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      setColumnsOrder,
    });

    const { result } = renderHook(() =>
      useDataGridColumns(mockTestDocs, rows, false),
    );

    expect(setColumnsOrder).toHaveBeenCalledWith([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ]);
    expect(result.current.reorderedColumns[17].key).toBe('otherTags');
    expect(result.current.reorderedColumns[18].key).toBe('lastUpdated');
  });
});

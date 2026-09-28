import { act, renderHook } from '@testing-library/react';
import useDataGridColumns from '@views/testDataList/hooks/useDataGridColumns';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDataGrid from './useDataGrid';

const initialColumnsOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

vi.mock('@views/testDataList/stores/useDataGridStyleStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataList/hooks/useDataGridColumns', () => ({
  default: vi.fn(),
}));

describe('useDataGrid', () => {
  const setColumnWidths = vi.fn();
  const setColumnsOrder = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDataGridStyleStore).mockReturnValue({
      setColumnWidths: setColumnWidths,
      setColumnsOrder: setColumnsOrder,
    });

    vi.mocked(useDataGridColumns).mockReturnValue({
      reorderedColumns: [],
      onColumnsReorder: vi.fn(),
      initialColumnsOrder: initialColumnsOrder,
    });
  });

  it('resetOrderAndWidthsが正しく動作する', () => {
    const { result } = renderHook(() => useDataGrid());

    act(() => {
      result.current.resetOrderAndWidths();
    });

    expect(setColumnsOrder).toHaveBeenCalledWith(initialColumnsOrder);
    expect(setColumnWidths).toHaveBeenCalledWith(new Map());
  });
});

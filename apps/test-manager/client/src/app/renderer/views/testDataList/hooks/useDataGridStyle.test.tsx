import { act, renderHook } from '@testing-library/react';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import type { DataGridHandle } from 'react-data-grid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDataGridStyle from './useDataGridStyle';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

describe('useDataGridStyle', () => {
  const frozenIndex = 1;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue(frozenIndex);
  });

  it('renderBorder が正しくクラスを操作する', () => {
    const { result } = renderHook(() => useDataGridStyle());

    const mockElement = document.createElement('div');
    const mockHeaderCell = document.createElement('div');
    const mockDataCell = document.createElement('div');

    mockHeaderCell.setAttribute('role', 'columnheader');
    mockHeaderCell.setAttribute('aria-colindex', '2'); // frozenIndex + 1
    mockDataCell.setAttribute('aria-colindex', '2');

    mockElement.appendChild(mockHeaderCell);
    mockElement.appendChild(mockDataCell);

    const mockDataGridRef = {
      current: {
        element: mockElement,
      },
    } as React.RefObject<DataGridHandle>;

    act(() => {
      result.current.renderBorder(mockDataGridRef);
    });

    // クラスが正しく追加されているか確認
    expect(
      mockHeaderCell.classList.contains('custom-frozen-header-border'),
    ).toBe(true);
    expect(mockDataCell.classList.contains('custom-frozen-border')).toBe(true);
  });
});

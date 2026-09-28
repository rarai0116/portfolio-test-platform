import { fireEvent, render, screen } from '@testing-library/react';
import HeaderCell from '@views/testDataList/organisms/headerCell';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import type { Row } from '@views/testDataList/types/reactGridDataTypes';
import type { ReactNode } from 'react';
import type { RenderCellProps, RenderHeaderCellProps } from 'react-data-grid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

describe('HeaderCell', () => {
  const renderHeaderCellProps: RenderHeaderCellProps<Row, unknown> = {
    column: {
      key: 'year',
      idx: 1,
      name: '年',
      parent: undefined,
      level: 0,
      width: '',
      minWidth: 0,
      maxWidth: undefined,
      resizable: false,
      sortable: false,
      draggable: false,
      frozen: false,
      renderCell: (_props: RenderCellProps<Row, unknown>): ReactNode => {
        throw new Error('Function not implemented.');
      },
      renderHeaderCell: (
        _props: RenderHeaderCellProps<Row, unknown>,
      ): ReactNode => {
        throw new Error('Function not implemented.');
      },
    },
    sortDirection: 'ASC',
    priority: 1,
    tabIndex: 0,
  };

  const defaultProps = {
    ...renderHeaderCellProps,
    onCheckedChange: vi.fn(),
    filterOption: ['Option1', 'Option2'],
    selectStopPropagation: vi.fn(),
    dragProps: {
      onDragEnter: vi.fn(),
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn(),
    },
    onSortColumns: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue({
      dragHighLightIndex: null,
      checkedFilters: { year: ['Option1', 'Option2'] },
      updateFilter: vi.fn(),
      setCheckedFilters: vi.fn(),
      setSelectedRows: vi.fn(),
    });
  });

  it('HeaderCellが表示される', () => {
    render(<HeaderCell {...defaultProps} />);
    // ラベルが正しく表示されているか確認
    expect(screen.getByText('年')).toBeInTheDocument();

    // DataListMenuが存在するか確認
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('ドラッグイベントが正しく処理される', () => {
    render(<HeaderCell {...defaultProps} />);
    const dragArea = screen.getByText('年').closest('div');

    // ドラッグイベントを発火
    if (dragArea) {
      fireEvent.dragEnter(dragArea);
      fireEvent.dragOver(dragArea);
      fireEvent.dragLeave(dragArea);
      fireEvent.drop(dragArea);
    }

    // 各ドラッグイベントが呼び出されたか確認
    expect(defaultProps.dragProps.onDragEnter).toHaveBeenCalledTimes(1);
    expect(defaultProps.dragProps.onDragOver).toHaveBeenCalledTimes(1);
    expect(defaultProps.dragProps.onDragLeave).toHaveBeenCalledTimes(1);
    expect(defaultProps.dragProps.onDrop).toHaveBeenCalledTimes(1);
  });
});

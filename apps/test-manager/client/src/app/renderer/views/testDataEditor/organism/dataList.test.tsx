import type { ListItemProps } from '@parts/listItem';
import { act, render, screen } from '@testing-library/react';
import useSelectedDataDisplayStore from '@views/testDataEditor/store/useSelectedDataDisplayStore';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DataList from './dataList';

vi.mock('@parts/listItem', () => ({
  default: ({
    id,
    text,
    isSelected,
    onClick,
    textClassName,
    suffix,
  }: ListItemProps) => (
    <button
      type="button"
      data-testid={`${id}`}
      data-selected={isSelected}
      data-text-class={textClassName}
      onClick={onClick}
    >
      {text}
      {suffix}
    </button>
  ),
}));

describe('DataList', () => {
  const mockIdList = ['id-1', 'id-2', 'id-3'];
  const mockOnClick = vi.fn();

  afterEach(() => {
    act(() => {
      useSelectedDataDisplayStore.getState().clearDisplayEntries();
    });
  });

  const defaultProps = {
    idList: mockIdList,
    selectedId: undefined,
    onClick: mockOnClick,
  };

  const seedDisplayEntries = () => {
    act(() => {
      useSelectedDataDisplayStore.getState().setDisplayEntries([
        { id: 'id-1', name: '項目1', status: '準備完了' },
        { id: 'id-2', name: '項目2', status: '準備中' },
        { id: 'id-3', name: '項目3', status: 'エラー' },
      ]);
    });
  };

  it('idListの数だけListItemが表示される', () => {
    seedDisplayEntries();
    render(<DataList {...defaultProps} />);
    mockIdList.forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });
  });

  it('selectedIdと一致するアイテムがisSelected=trueになる', () => {
    seedDisplayEntries();
    render(<DataList {...defaultProps} selectedId="id-2" />);
    mockIdList.forEach((id, index) => {
      const isSelected = id === 'id-2' ? 'true' : 'false';
      expect(screen.getByTestId(mockIdList[index])).toHaveAttribute(
        'data-selected',
        isSelected,
      );
    });
  });

  it('idListが空の場合、ListItemは表示されない', () => {
    render(<DataList {...defaultProps} idList={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('statusに応じて文字色と準備中インジケーターを切り替える', () => {
    seedDisplayEntries();

    render(<DataList {...defaultProps} />);

    expect(screen.getByTestId('id-1')).toHaveAttribute('data-text-class', '');

    const preparingItem = screen.getByTestId('id-2');
    expect(preparingItem).toHaveAttribute('data-text-class', '');
    expect(preparingItem.querySelector('.bg-warning-icon')).toBeInTheDocument();

    expect(screen.getByTestId('id-3')).toHaveAttribute(
      'data-text-class',
      'text-error-text',
    );
  });
});

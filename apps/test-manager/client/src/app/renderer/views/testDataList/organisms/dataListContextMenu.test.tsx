import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataListContextMenu from '@views/testDataList/organisms/dataListContextMenu';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setFrozenIndex = vi.fn();

vi.mock('@views/testDataList/stores/useDataGridStyleStore', () => ({
  default: vi.fn(() => ({
    setFrozenIndex: setFrozenIndex,
  })),
}));

describe('DataListContextMenu', () => {
  const defaultProps = {
    columnKey: 'test-column',
    index: 1,
    children: <>Trigger</>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DataListContextMenuが表示される', () => {
    render(<DataListContextMenu {...defaultProps} />);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  it('「この列で固定」をクリックするとsetFrozenIndexが呼ばれる', async () => {
    render(<DataListContextMenu {...defaultProps} />);
    const user = userEvent.setup();
    const trigger = screen.getByText('Trigger');
    await user.pointer({ keys: '[MouseRight]', target: trigger });

    const setFrozen = screen.getByText('この列で固定');
    await user.click(setFrozen);

    expect(setFrozenIndex).toHaveBeenCalledWith(1);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RemovableListItem, {
  type RemovableListItemProps,
} from './removableListItem';

describe('RemovableListItem', () => {
  const defaultProps: RemovableListItemProps = {
    id: 'test-id',
    text: 'テストアイテム',
    onClick: vi.fn(),
  };

  it('テキストが表示される', () => {
    render(<RemovableListItem {...defaultProps} />);
    expect(screen.getByText('テストアイテム')).toBeInTheDocument();
  });

  it('削除ボタンが表示される', () => {
    render(<RemovableListItem {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('削除ボタンをクリックするとonClickが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<RemovableListItem {...defaultProps} />);
    await user.click(screen.getByRole('button'));
    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });
});

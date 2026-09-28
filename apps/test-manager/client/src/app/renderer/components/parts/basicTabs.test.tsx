import BasicTabs, { type TabItem } from '@parts/basicTabs.tsx';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('BasicTabs', () => {
  const mockTabItems: TabItem[] = [
    { id: 'tab1', label: 'タブ1', content: <div>タブ1のコンテンツ</div> },
    { id: 'tab2', label: 'タブ2', content: <div>タブ2のコンテンツ</div> },
  ];

  const defaultProps = { tabs: mockTabItems };

  it('タブラベルが正しく生成される', () => {
    render(<BasicTabs {...defaultProps} />);
    expect(screen.getByText('タブ1')).toBeInTheDocument();
    expect(screen.getByText('タブ2')).toBeInTheDocument();
  });

  it('タブコンテンツが正しく生成される', () => {
    render(<BasicTabs {...defaultProps} />);
    expect(screen.getByText('タブ1のコンテンツ')).toBeInTheDocument();
  });

  it('タブをクリックすると対応するコンテンツが表示される', async () => {
    const user = userEvent.setup();
    render(<BasicTabs {...defaultProps} />);

    const tab1Content = screen.getByText('タブ1のコンテンツ');
    const tab1Panel = tab1Content.closest('[data-slot="tabs-content"]');
    expect(tab1Panel).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByText('タブ2'));

    const tab2Content = await screen.findByText('タブ2のコンテンツ');
    const tab2Panel = tab2Content.closest('[data-slot="tabs-content"]');

    expect(tab2Panel).toHaveAttribute('data-state', 'active');
    expect(tab1Panel).toHaveAttribute('data-state', 'inactive');
  });
});

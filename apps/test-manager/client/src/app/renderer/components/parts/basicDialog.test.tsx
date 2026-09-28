import BasicDialog from '@parts/basicDialog.tsx';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

describe('BasicDialog', () => {
  it('props.triggerTextでトリガーが表示される', () => {
    render(<BasicDialog triggerText="Open Dialog" />);
    expect(screen.getByText('Open Dialog')).toBeInTheDocument();
  });

  it('props.titleでタイトルが表示される', async () => {
    const user = userEvent.setup();
    render(<BasicDialog triggerText="Open Dialog" title="タイトル" />);
    await user.click(screen.getByText('Open Dialog'));
    await waitFor(() => {
      expect(screen.getByText('タイトル')).toBeInTheDocument();
    });
  });

  it('props.descriptionで説明文が表示される', async () => {
    const user = userEvent.setup();
    render(<BasicDialog triggerText="Open Dialog" description="説明文" />);
    await user.click(screen.getByText('Open Dialog'));
    await waitFor(() => {
      expect(screen.getByText('説明文')).toBeInTheDocument();
    });
  });

  it('props.primaryButtonTextでプライマリボタンが表示される', async () => {
    const user = userEvent.setup();
    render(<BasicDialog triggerText="Open Dialog" primaryButtonText="保存" />);
    await user.click(screen.getByText('Open Dialog'));
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
  });

  it('props.secondaryButtonTextでセカンダリボタンが表示される', async () => {
    const user = userEvent.setup();
    render(
      <BasicDialog
        triggerText="Open Dialog"
        secondaryButtonText="キャンセル"
      />,
    );
    await user.click(screen.getByText('Open Dialog'));
    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });
  });

  it('props.onClickPrimaryButtonが呼ばれる', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <BasicDialog
        triggerText="Open Dialog"
        primaryButtonText="保存"
        onClickPrimaryButton={handleClick}
      />,
    );
    await user.click(screen.getByText('Open Dialog'));
    // 保存
    await waitFor(() => {
      expect(screen.getByText('保存')).toBeInTheDocument();
    });
    await user.click(screen.getByText('保存'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('props.onClickSecondaryButtonが呼ばれる', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <BasicDialog
        triggerText="Open Dialog"
        secondaryButtonText="キャンセル"
        onClickSecondaryButton={handleClick}
      />,
    );
    await user.click(screen.getByText('Open Dialog'));
    // 「キャンセル」ボタンが表示されるまで待つ
    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });
    await user.click(screen.getByText('キャンセル'));
    expect(handleClick).toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StatusBar from './statusBar';

vi.mock('../../../components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      {...props}
    />
  ),
}));

vi.mock('../../../components/ui/label', () => ({
  Label: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

describe('StatusBar', () => {
  const defaultProps = {
    autoCheckMessage: '正常',
    autoCheckHasError: false,
    calibrationLocked: false,
    status: 'waiting' as const,
  };

  it('statusがerrorのときStatusPillにエラーを表示する', () => {
    render(<StatusBar {...defaultProps} status="error" />);

    expect(screen.getByTestId('status-pill')).toHaveTextContent('エラー');
  });

  it('statusTextがあればdefaultTextより優先して表示する', () => {
    render(<StatusBar {...defaultProps} status="error" statusText="要確認" />);

    expect(screen.getByTestId('status-pill')).toHaveTextContent('要確認');
  });

  it('校正ロック変更時にコールバックを呼ぶ', async () => {
    const user = userEvent.setup();
    const onChangeCalibrationLocked = vi.fn();

    render(
      <StatusBar
        {...defaultProps}
        onChangeCalibrationLocked={onChangeCalibrationLocked}
      />,
    );

    await user.click(screen.getByTestId('calibration-locked'));

    expect(onChangeCalibrationLocked).toHaveBeenCalledWith(true);
  });
});

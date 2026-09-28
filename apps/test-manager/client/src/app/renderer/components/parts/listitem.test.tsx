import ListItem from '@parts/listItem.tsx';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('ListItem', () => {
  const defaultProps = {
    id: 'itemId',
    text: 'テキスト',
    isSelected: false,
    onClick: () => {
      console.log('clicked');
    },
  };

  it('Buttonコンポーネントでレンダリングされる', () => {
    render(<ListItem {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('ID属性が正しく設定される', () => {
    render(<ListItem {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('id', defaultProps.id);
    expect(button.id).toBe(defaultProps.id);
  });

  it('テキストが表示される', () => {
    render(<ListItem {...defaultProps} />);
    expect(screen.getByText('テキスト')).toBeInTheDocument();
  });

  it('isSelected=trueで、bg-demoblue-50が付与される', () => {
    render(<ListItem {...defaultProps} isSelected={true} />);
    expect(screen.getByRole('button')).toHaveClass('bg-demoblue-50');
  });

  it('isSelected=falseでbg-whiteが付与される', () => {
    render(<ListItem {...defaultProps} isSelected={false} />);
    expect(screen.getByRole('button')).toHaveClass('bg-white');
  });

  it('propsで渡したonClickが呼ばれる', () => {
    const handleClick = vi.fn();
    render(<ListItem {...defaultProps} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('onClickハンドラーにイベントオブジェクトが正しく渡される', () => {
    const handleClick = vi.fn();
    render(<ListItem {...defaultProps} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
    const [event] = handleClick.mock.calls[0];
    expect(event.type).toBe('click');
  });

  it('IDを取得できる', () => {
    const handleClick = vi.fn();
    render(<ListItem {...defaultProps} onClick={handleClick} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('id', defaultProps.id);

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
    const [event] = handleClick.mock.calls[0];
    expect(event.target.id).toBe(defaultProps.id);
  });
});

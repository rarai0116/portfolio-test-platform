import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TextInput, { getTextLength } from './textInput';

describe('TextInput', () => {
  it('半角を0.5文字、全角を1文字として数える', () => {
    expect(getTextLength('全角abcｱｲ')).toBe(4.5);
  });

  it('表示上の文字数上限を超える入力を切り詰める', () => {
    const onChange = vi.fn();
    render(
      <TextInput aria-label="テキスト" maxLength={3} onChange={onChange} />,
    );

    const input = screen.getByLabelText('テキスト');
    fireEvent.change(input, { target: { value: '全角12345超過' } });

    expect(input).toHaveValue('全角12');
    expect(onChange).toHaveBeenCalled();
  });
});

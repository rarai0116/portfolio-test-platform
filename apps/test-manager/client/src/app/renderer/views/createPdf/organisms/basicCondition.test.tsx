import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import BasicCondition from './basicCondition';

describe('BasicCondition', () => {
  let onTitleChange: Mock<(value: string) => void>;
  let onTitleEditStart: Mock<(editKey: string) => void>;
  let onTitleEditEnd: Mock<(editKey: string) => void>;
  let onGradeChange: Mock<(value: 1 | 2) => void>;

  beforeEach(() => {
    onTitleChange = vi.fn();
    onTitleEditStart = vi.fn();
    onTitleEditEnd = vi.fn();
    onGradeChange = vi.fn();
  });
  it('controlled title は入力中に commit せず blur で確定する', () => {
    render(
      <BasicCondition
        onTitleChange={onTitleChange}
        onTitleEditEnd={onTitleEditEnd}
        onTitleEditStart={onTitleEditStart}
        onGradeChange={onGradeChange}
        title="初期タイトル"
        grade={1}
        creationType="exam"
      />,
    );

    const input = screen.getByPlaceholderText('タイトルを入力');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '新タイトル' } });

    expect(onTitleChange).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(onTitleChange).toHaveBeenCalledWith('新タイトル');
    expect(onTitleEditStart).toHaveBeenCalledWith('basic-condition:title');
    expect(onTitleEditEnd).toHaveBeenCalledWith('basic-condition:title');
  });
});

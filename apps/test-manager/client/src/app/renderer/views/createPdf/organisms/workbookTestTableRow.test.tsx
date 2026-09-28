import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkbookTestTableRow from './workbookTestTableRow';

describe('WorkbookTestTableRow', () => {
  it('focus と blur で table editing の開始と終了を通知する', () => {
    const beginGuardedEdit = vi.fn();
    const endGuardedEdit = vi.fn();

    render(
      <table>
        <tbody>
          <WorkbookTestTableRow
            previewUpdate={{ beginGuardedEdit, endGuardedEdit }}
            rowId="row-1"
          />
        </tbody>
      </table>,
    );

    const selectedNoInput = screen.getByLabelText('問題No');
    fireEvent.focus(selectedNoInput);
    fireEvent.change(selectedNoInput, { target: { value: '12' } });
    fireEvent.blur(selectedNoInput);

    expect(beginGuardedEdit).toHaveBeenCalledWith('row-1:selected-no');
    expect(endGuardedEdit).toHaveBeenCalledWith('row-1:selected-no');
    expect(selectedNoInput).toHaveValue(12);
  });

  it('Escape で staged value を巻き戻す', () => {
    render(
      <table>
        <tbody>
          <WorkbookTestTableRow rowId="row-2" />
        </tbody>
      </table>,
    );

    const selectedNoInput = screen.getByLabelText('問題No');
    fireEvent.focus(selectedNoInput);
    fireEvent.change(selectedNoInput, { target: { value: '7' } });
    fireEvent.keyDown(selectedNoInput, { key: 'Escape' });

    expect(selectedNoInput).toHaveValue(null);
  });

  it('選択肢No は 1-based 入力を local committed value に反映する', () => {
    render(
      <table>
        <tbody>
          <WorkbookTestTableRow rowId="row-3" />
        </tbody>
      </table>,
    );

    const choiceNoInput = screen.getByLabelText('選択肢No');
    fireEvent.focus(choiceNoInput);
    fireEvent.change(choiceNoInput, { target: { value: '3' } });
    fireEvent.blur(choiceNoInput);

    expect(choiceNoInput).toHaveValue(3);
  });
});

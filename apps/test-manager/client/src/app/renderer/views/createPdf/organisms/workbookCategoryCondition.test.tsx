import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkbookCategoryTableRow as WorkbookCategoryTableRowData } from '@views/createPdf/types/viewState';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import WorkbookCategoryTableRow from './workbookCategoryCondition';

const SUBJECT = '学科Ⅰ' as const;
const BIG = '大分類A';
const SMALLS = ['小分類A-1', '小分類A-2', '小分類A-3'] as const;

const categoryTreeBySubject = {
  学科Ⅰ: [{ big: BIG, small: [...SMALLS] }],
  学科Ⅱ: [{ big: '大分類B', small: ['小分類B-1', '小分類B-2'] }],
  学科Ⅲ: [],
  学科Ⅳ: [{ big: '大分類C', small: ['小分類C-1'] }],
  学科Ⅴ: [{ big: '大分類D', small: [] }],
};

// 小分類A-2 は maxCount=0（選択不可）
const maxCountBySmallKey = new Map([
  [`${SUBJECT}::${BIG}::小分類A-1`, 3],
  [`${SUBJECT}::${BIG}::小分類A-2`, 0],
  [`${SUBJECT}::${BIG}::小分類A-3`, 5],
]);

describe('WorkbookCategoryTableRow 大カテゴリ全選択チェックボックス', () => {
  let onAddCondition: Mock;
  let onAddConditions: Mock;
  let onUpdateCondition: Mock;
  let onRemoveCondition: Mock;
  let onRemoveConditions: Mock;
  let onSubjectChange: Mock;

  beforeEach(() => {
    onAddCondition = vi.fn();
    onAddConditions = vi.fn();
    onUpdateCondition = vi.fn();
    onRemoveCondition = vi.fn();
    onRemoveConditions = vi.fn();
    onSubjectChange = vi.fn();
  });

  const renderComponent = (categoryTable: WorkbookCategoryTableRowData[]) =>
    render(
      <WorkbookCategoryTableRow
        categoryTable={categoryTable}
        categoryTreeBySubject={categoryTreeBySubject}
        maxCountBySmallKey={maxCountBySmallKey}
        onAddCondition={onAddCondition}
        onAddConditions={onAddConditions}
        onUpdateCondition={onUpdateCondition}
        onRemoveCondition={onRemoveCondition}
        onRemoveConditions={onRemoveConditions}
        selectedSubject={SUBJECT}
        onSubjectChange={onSubjectChange}
      />,
    );

  it('全未選択状態で大カテゴリをチェックすると maxCount>0 の小分類が onAddConditions で一括追加される', () => {
    renderComponent([]);
    const bigCheckbox = screen.getByRole('checkbox', { name: BIG });

    fireEvent.click(bigCheckbox);

    expect(onAddConditions).toHaveBeenCalledOnce();
    const initials: WorkbookCategoryTableRowData[] =
      onAddConditions.mock.calls[0][0];
    // 小分類A-2 (maxCount=0) を除いた 2 件が渡される
    expect(initials).toHaveLength(2);
    expect(initials.map((i) => i.smallCategoryTag)).toEqual(
      expect.arrayContaining(['小分類A-1', '小分類A-3']),
    );
    // 初回チェックは savedCounts がないため maxCount で追加される
    expect(
      initials.find((i) => i.smallCategoryTag === '小分類A-1')?.count,
    ).toBe(3);
    expect(
      initials.find((i) => i.smallCategoryTag === '小分類A-3')?.count,
    ).toBe(5);
    expect(onAddCondition).not.toHaveBeenCalled();
  });

  it('全選択済み状態で大カテゴリのチェックを外すと配下全行の id が onRemoveConditions に一括渡される', () => {
    const categoryTable: WorkbookCategoryTableRowData[] = [
      {
        id: 'row-1',
        subject: SUBJECT,
        bigCategoryTag: BIG,
        smallCategoryTag: '小分類A-1',
        count: 1,
      },
      {
        id: 'row-3',
        subject: SUBJECT,
        bigCategoryTag: BIG,
        smallCategoryTag: '小分類A-3',
        count: 1,
      },
    ];
    renderComponent(categoryTable);
    const bigCheckbox = screen.getByRole('checkbox', { name: BIG });

    fireEvent.click(bigCheckbox);

    expect(onRemoveConditions).toHaveBeenCalledOnce();
    const ids: string[] = onRemoveConditions.mock.calls[0][0];
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining(['row-1', 'row-3']));
    expect(onRemoveCondition).not.toHaveBeenCalled();
    expect(onAddConditions).not.toHaveBeenCalled();
  });

  it('全選択済みのとき大カテゴリチェックボックスは checked 状態になる', () => {
    const categoryTable: WorkbookCategoryTableRowData[] = [
      {
        id: 'row-1',
        subject: SUBJECT,
        bigCategoryTag: BIG,
        smallCategoryTag: '小分類A-1',
        count: 1,
      },
      {
        id: 'row-3',
        subject: SUBJECT,
        bigCategoryTag: BIG,
        smallCategoryTag: '小分類A-3',
        count: 1,
      },
    ];
    renderComponent(categoryTable);
    const bigCheckbox = screen.getByRole('checkbox', { name: BIG });

    expect(bigCheckbox).toBeChecked();
  });

  it('一部選択済みのとき大カテゴリチェックボックスは indeterminate 状態になる', () => {
    const categoryTable: WorkbookCategoryTableRowData[] = [
      {
        id: 'row-1',
        subject: SUBJECT,
        bigCategoryTag: BIG,
        smallCategoryTag: '小分類A-1',
        count: 1,
        // 小分類A-3 は未選択
      },
    ];
    renderComponent(categoryTable);
    const bigCheckbox = screen.getByRole('checkbox', { name: BIG });

    expect(bigCheckbox).toHaveAttribute('aria-checked', 'mixed');
  });

  it('全未選択かつ selectable が 0 件のとき大カテゴリチェックボックスは unchecked のまま onAddConditions を呼ばない', () => {
    const emptyMaxCount = new Map([
      [`${SUBJECT}::${BIG}::小分類A-1`, 0],
      [`${SUBJECT}::${BIG}::小分類A-2`, 0],
      [`${SUBJECT}::${BIG}::小分類A-3`, 0],
    ]);
    render(
      <WorkbookCategoryTableRow
        categoryTable={[]}
        categoryTreeBySubject={categoryTreeBySubject}
        maxCountBySmallKey={emptyMaxCount}
        onAddCondition={onAddCondition}
        onAddConditions={onAddConditions}
        onUpdateCondition={onUpdateCondition}
        onRemoveCondition={onRemoveCondition}
        onRemoveConditions={onRemoveConditions}
        selectedSubject={SUBJECT}
        onSubjectChange={onSubjectChange}
      />,
    );
    const bigCheckbox = screen.getByRole('checkbox', { name: BIG });

    fireEvent.click(bigCheckbox);

    expect(onAddConditions).not.toHaveBeenCalled();
  });
});

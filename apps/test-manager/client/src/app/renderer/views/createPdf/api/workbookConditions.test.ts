import {
  createStableWorkbookCategoryTableRow,
  createWorkbookCategoryConditionId,
  createWorkbookCategoryTableRow,
} from '@views/createPdf/api/workbookConditions';
import { describe, expect, it } from 'vitest';

describe('workbookConditions', () => {
  it('同一カテゴリ条件から同じ Workbook 安定IDを生成し count は含めない', () => {
    const id = createWorkbookCategoryConditionId({
      subject: '学科Ⅰ',
      bigCategoryTag: '大分類A',
      smallCategoryTag: '小分類A',
    });

    expect(id).toBe(
      `workbook-category-condition:v1:${encodeURIComponent(
        JSON.stringify(['学科Ⅰ', '大分類A', '小分類A']),
      )}`,
    );
    expect(
      createStableWorkbookCategoryTableRow({
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A',
        count: 1,
      }).id,
    ).toBe(
      createStableWorkbookCategoryTableRow({
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A',
        count: 99,
      }).id,
    );
  });

  it('smallCategoryTag が null の場合も安定IDを生成する', () => {
    expect(
      createWorkbookCategoryConditionId({
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: null,
      }),
    ).toBe(
      `workbook-category-condition:v1:${encodeURIComponent(
        JSON.stringify(['学科Ⅰ', '大分類A', null]),
      )}`,
    );
  });

  it('既存の Workbook 条件行 factory はランダムID生成のままにする', () => {
    const row = createWorkbookCategoryTableRow({
      subject: null,
      bigCategoryTag: null,
      smallCategoryTag: null,
      count: 1,
    });

    expect(row.id.startsWith('workbook-category-condition-')).toBe(true);
  });
});

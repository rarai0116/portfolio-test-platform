import type { CreatePdfTestCategoryResourceState } from '@views/createPdf/store/useCreatePdfResourceStore';
import { describe, expect, it } from 'vitest';
import { buildCategoryTreeBySubject } from './categoryUtils';

const createCategoryState = (
  override: Partial<CreatePdfTestCategoryResourceState> = {},
): CreatePdfTestCategoryResourceState => ({
  grade: 2,
  bigKeysBySubject: {
    学科Ⅰ: ['計画'],
    学科Ⅱ: ['法規'],
    学科Ⅲ: ['構造'],
    学科Ⅳ: ['施工'],
    学科Ⅴ: [],
  },
  smallKeysBySubjectAndBig: {
    '学科Ⅰ::計画': ['原論'],
    '学科Ⅱ::法規': ['建築基準法'],
    '学科Ⅲ::構造': ['力学'],
    '学科Ⅳ::施工': ['躯体工事'],
  },
  isLoading: false,
  ...override,
});

describe('buildCategoryTreeBySubject', () => {
  it('大分類がない学科はツリーから除外する', () => {
    const tree = buildCategoryTreeBySubject(createCategoryState());

    expect(Object.keys(tree)).toEqual(['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ']);
    expect(tree.学科Ⅴ).toBeUndefined();
  });

  it('大分類がある学科は小分類を含むツリーに変換する', () => {
    const tree = buildCategoryTreeBySubject(createCategoryState());

    expect(tree.学科Ⅰ).toEqual([{ big: '計画', small: ['原論'] }]);
  });
});

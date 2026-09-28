import type { TestData, TestSubject } from '@shared/types/contracts';
import {
  buildCreatePdfTestCategoryCacheKey,
  type CreatePdfTestCategoryResourceState,
} from '@views/createPdf/store/useCreatePdfResourceStore';

export type CategoryTree = { big: string; small: string[] }[];
export type CategoryTreeBySubject = Partial<Record<TestSubject, CategoryTree>>;

/**
 * testCategory リソースを学科別ツリーに変換する純粋関数。
 * reactivity は呼び出し側の useMemo が担う。
 */
export const buildCategoryTreeBySubject = (
  testCategory: CreatePdfTestCategoryResourceState,
): CategoryTreeBySubject => {
  const result: CategoryTreeBySubject = {};
  for (const subject of Object.keys(
    testCategory.bigKeysBySubject,
  ) as TestSubject[]) {
    const bigKeys = testCategory.bigKeysBySubject[subject];
    if (bigKeys.length === 0) continue;

    result[subject] = bigKeys.map((big) => {
      const key = buildCreatePdfTestCategoryCacheKey(subject, big);
      return {
        big,
        small: (testCategory.smallKeysBySubjectAndBig[key] ?? []).slice(),
      };
    });
  }
  return result;
};

/**
 * testDataByNo から小分類ごとの問題数を集計する。
 * key: "subject::bigCategoryTag::smallCategoryTag"
 */
export const buildMaxCountBySmallKey = (
  testDataByNo: ReadonlyMap<number, TestData>,
): ReadonlyMap<string, number> => {
  const map = new Map<string, number>();
  for (const d of testDataByNo.values()) {
    const key = `${d.subject}::${d.bigCategoryTag}::${d.smallCategoryTag}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
};

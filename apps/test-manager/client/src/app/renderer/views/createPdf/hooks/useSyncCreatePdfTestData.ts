import type { GradeId } from '@shared/types/contracts';
import { toGradeId } from '@views/createPdf/hooks/useCreatePdfTestData';
import useCreatePdfResourceStore, {
  buildCreatePdfTestCategoryCacheKey,
  CREATE_PDF_TEST_CATEGORY_SUBJECTS,
  type CreatePdfTestCategoryResourceState,
  createEmptyCreatePdfBigKeysBySubject,
} from '@views/createPdf/store/useCreatePdfResourceStore';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useCreatePdfTestData from './useCreatePdfTestData';

type LoadCategoryResult = Pick<
  CreatePdfTestCategoryResourceState,
  'bigKeysBySubject' | 'smallKeysBySubjectAndBig'
>;

const loadCategoryData = async (
  gradeId: GradeId,
  isCancelled: () => boolean,
): Promise<LoadCategoryResult | null> => {
  const bigKeysBySubject = createEmptyCreatePdfBigKeysBySubject();
  const smallKeysBySubjectAndBig: Record<string, readonly string[]> = {};

  for (const subject of CREATE_PDF_TEST_CATEGORY_SUBJECTS) {
    const bigResult = await window.testCategory.getKey(gradeId, subject);
    if (isCancelled()) return null;
    if (!bigResult.ok) continue;

    const bigKeys = Array.from(
      new Set(bigResult.keys.map((k) => k.trim()).filter(Boolean)),
    );
    bigKeysBySubject[subject] = bigKeys;

    for (const bigCategoryTag of bigKeys) {
      const smallResult = await window.testCategory.getKey(
        gradeId,
        subject,
        bigCategoryTag,
      );
      if (isCancelled()) return null;
      if (!smallResult.ok) continue;

      smallKeysBySubjectAndBig[
        buildCreatePdfTestCategoryCacheKey(subject, bigCategoryTag)
      ] = Array.from(
        new Set(smallResult.keys.map((k) => k.trim()).filter(Boolean)),
      );
    }
  }

  return { bigKeysBySubject, smallKeysBySubjectAndBig };
};

const useSyncCreatePdfTestData = (grade: 1 | 2) => {
  const { testDataSet, isLoading } = useCreatePdfTestData(grade);
  const {
    setTestData,
    startTestDataLoad,
    setTestCategory,
    startTestCategoryLoad,
  } = useCreatePdfResourceStore(useShallow((s) => s.actions));

  // biome-ignore lint/correctness/useExhaustiveDependencies: startTestDataLoad は常に同じ関数参照を返すため、依存配列に含める必要はない
  useEffect(() => {
    startTestDataLoad(grade);
  }, [grade]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ローディング状態と testDataSet が変わったときに store を更新したい。setTestData は常に同じ関数参照を返すため、依存配列に含める必要はない
  useEffect(() => {
    setTestData({
      maps: {
        byNo: testDataSet.byNo,
        byId: testDataSet.byId,
        byUuid: testDataSet.byUuid,
      },
      isLoading,
    });
  }, [isLoading, testDataSet]);

  useEffect(() => {
    let cancelled = false;
    const gradeId = toGradeId(grade);

    const load = async () => {
      startTestCategoryLoad(grade);
      const result = await loadCategoryData(gradeId, () => cancelled);
      if (result === null) return; // キャンセル済み
      setTestCategory({ grade, ...result, isLoading: false });
    };

    void load();

    const off = window.testCategory.onUpdated((changes) => {
      if (changes.some((c) => c.grade === gradeId)) void load();
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [grade, setTestCategory, startTestCategoryLoad]);
};

export default useSyncCreatePdfTestData;

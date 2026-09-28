import type { TestData } from '@shared/types/contracts';
import { renderHook, waitFor } from '@testing-library/react';
import useCreatePdfResourceStore, {
  buildCreatePdfTestCategoryCacheKey,
  CREATE_PDF_TEST_CATEGORY_SUBJECTS,
} from '@views/createPdf/store/useCreatePdfResourceStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCreatePdfTestData from './useCreatePdfTestData';
import useSyncCreatePdfTestData from './useSyncCreatePdfTestData';

vi.mock('./useCreatePdfTestData', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./useCreatePdfTestData')>();
  return {
    ...actual,
    default: vi.fn(),
  };
});

const createTestData = (
  no: number,
  subject: TestData['subject'] = '学科Ⅰ',
): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '大分類A',
  ch1: '',
  ch2: '',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo: '',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject,
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
});

describe('useSyncCreatePdfTestData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreatePdfResourceStore.getState().actions.reset();
  });

  it('TestData と TestDataCategory を resource store に同期する', async () => {
    const testData = createTestData(1);
    const testDataByNo = new Map([[1, testData]]);
    const testDataById = new Map([['id-1', testData]]);
    const testDataByUuid = new Map<string, TestData>();

    vi.mocked(useCreatePdfTestData).mockReturnValue({
      testDataSet: {
        byNo: testDataByNo,
        byId: testDataById,
        byUuid: testDataByUuid,
      },
      testDataByNo,
      testDataById,
      testDataByUuid,
      isLoading: false,
    });

    vi.mocked(window.testCategory.getKey).mockImplementation(
      async (_grade, subject, bigCategoryTag) => {
        if (!subject) return { ok: true, keys: [] };
        if (!bigCategoryTag) {
          return { ok: true, keys: [`${subject}-大分類`] };
        }
        return { ok: true, keys: [`${bigCategoryTag}-小分類`] };
      },
    );

    renderHook(() => useSyncCreatePdfTestData(1));

    await waitFor(() => {
      expect(useCreatePdfResourceStore.getState().testCategory.isLoading).toBe(
        false,
      );
    });

    const state = useCreatePdfResourceStore.getState();

    expect(state.testData.isLoading).toBe(false);
    expect(state.testData.maps.byNo.get(1)?.id).toBe('id-1');
    expect(state.testData.maps.byId.get('id-1')?.no).toBe(1);

    for (const subject of CREATE_PDF_TEST_CATEGORY_SUBJECTS) {
      expect(state.testCategory.bigKeysBySubject[subject]).toEqual([
        `${subject}-大分類`,
      ]);
      expect(
        state.testCategory.smallKeysBySubjectAndBig[
          buildCreatePdfTestCategoryCacheKey(subject, `${subject}-大分類`)
        ],
      ).toEqual([`${subject}-大分類-小分類`]);
    }
  });
});

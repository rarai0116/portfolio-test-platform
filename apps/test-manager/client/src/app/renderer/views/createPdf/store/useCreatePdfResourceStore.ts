import type { TestData, TestSubject } from '@shared/types/contracts';
import { create } from 'zustand';

export const CREATE_PDF_TEST_CATEGORY_SUBJECTS: readonly TestSubject[] = [
  '学科Ⅰ',
  '学科Ⅱ',
  '学科Ⅲ',
  '学科Ⅳ',
  '学科Ⅴ',
];

export const buildCreatePdfTestCategoryCacheKey = (
  subject: TestSubject,
  bigCategoryTag: string,
) => `${subject}::${bigCategoryTag.trim()}`;

type CreatePdfTestDataMaps = {
  byNo: ReadonlyMap<number, TestData>;
  byId: ReadonlyMap<string, TestData>;
  byUuid: ReadonlyMap<string, TestData>;
};

type CreatePdfTestDataResourceState = {
  maps: CreatePdfTestDataMaps;
  isLoading: boolean;
  /** maps が更新されるたびにインクリメントされる。commitKey への TestData 変化の反映に使用 */
  mapsVersion: number;
};

export type CreatePdfTestCategoryResourceState = {
  grade: 1 | 2;
  bigKeysBySubject: Readonly<Record<TestSubject, readonly string[]>>;
  smallKeysBySubjectAndBig: Readonly<Record<string, readonly string[]>>;
  isLoading: boolean;
};

type CreatePdfResourceStore = {
  testData: CreatePdfTestDataResourceState;
  testCategory: CreatePdfTestCategoryResourceState;
  actions: {
    setTestData: (
      next: Omit<CreatePdfTestDataResourceState, 'mapsVersion'>,
    ) => void;
    startTestDataLoad: (grade: 1 | 2) => void;
    setTestCategory: (next: CreatePdfTestCategoryResourceState) => void;
    startTestCategoryLoad: (grade: 1 | 2) => void;
    reset: () => void;
  };
};

const EMPTY_TEST_DATA_BY_NO: ReadonlyMap<number, TestData> = new Map();
const EMPTY_TEST_DATA_BY_ID: ReadonlyMap<string, TestData> = new Map();
const EMPTY_TEST_DATA_BY_UUID: ReadonlyMap<string, TestData> = new Map();

const createInitialTestDataResourceState =
  (): CreatePdfTestDataResourceState => ({
    maps: {
      byNo: EMPTY_TEST_DATA_BY_NO,
      byId: EMPTY_TEST_DATA_BY_ID,
      byUuid: EMPTY_TEST_DATA_BY_UUID,
    },
    isLoading: true,
    mapsVersion: 0,
  });

export const createEmptyCreatePdfBigKeysBySubject = (): Record<
  TestSubject,
  readonly string[]
> => {
  const next = {} as Record<TestSubject, readonly string[]>;

  for (const subject of CREATE_PDF_TEST_CATEGORY_SUBJECTS) {
    next[subject] = [];
  }

  return next;
};

const createInitialTestCategoryResourceState = (
  grade: 1 | 2 = 1,
): CreatePdfTestCategoryResourceState => ({
  grade,
  bigKeysBySubject: createEmptyCreatePdfBigKeysBySubject(),
  smallKeysBySubjectAndBig: {},
  isLoading: true,
});

const useCreatePdfResourceStore = create<CreatePdfResourceStore>((set) => ({
  testData: createInitialTestDataResourceState(),
  testCategory: createInitialTestCategoryResourceState(),
  actions: {
    setTestData: (next) =>
      set((s) => {
        // maps の参照が変化した時だけ mapsVersion を増加させる。
        // isLoading のみの変化では mapsVersion を増加させない。
        const isMapsChanged =
          next.maps.byNo !== s.testData.maps.byNo ||
          next.maps.byId !== s.testData.maps.byId ||
          next.maps.byUuid !== s.testData.maps.byUuid;

        return {
          testData: {
            ...next,
            mapsVersion: isMapsChanged
              ? s.testData.mapsVersion + 1
              : s.testData.mapsVersion,
          },
        };
      }),
    startTestDataLoad: () =>
      set({ testData: createInitialTestDataResourceState() }),
    setTestCategory: (next) => set({ testCategory: next }),
    startTestCategoryLoad: (grade) =>
      set({ testCategory: createInitialTestCategoryResourceState(grade) }),
    reset: () =>
      set({
        testData: createInitialTestDataResourceState(),
        testCategory: createInitialTestCategoryResourceState(),
      }),
  },
}));

export default useCreatePdfResourceStore;

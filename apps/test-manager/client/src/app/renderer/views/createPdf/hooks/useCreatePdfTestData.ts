// createPdf 専用の TestData 取得 hook
// testDataEditor の UI store を経由せず、直接購読する
import {
  type Grade,
  useTypedFirestoreHandler,
} from '@hooks/useTypedFirestoreHandler';
import type { TestData } from '@shared/types/contracts';
import { useEffect, useMemo, useRef } from 'react';

const EMPTY_TEST_DATA_BY_NO: ReadonlyMap<number, TestData> = new Map();
const EMPTY_TEST_DATA_BY_ID: ReadonlyMap<string, TestData> = new Map();
const EMPTY_TEST_DATA_BY_UUID: ReadonlyMap<string, TestData> = new Map();

/** createPdf 画面内の grade 数値 (1|2) を Firestore コレクション名へ変換する */
export const toGradeId = (grade: 1 | 2): Grade =>
  grade === 1 ? 'firstGrade' : 'secondGrade';

type CreatePdfTestDataResult = {
  testDataSet: {
    byNo: ReadonlyMap<number, TestData>;
    byId: ReadonlyMap<string, TestData>;
    byUuid: ReadonlyMap<string, TestData>;
  };
  /** no → TestData の高速引き当て用 map */
  testDataByNo: ReadonlyMap<number, TestData>;
  /** id → TestData の高速引き当て用 map */
  testDataById: ReadonlyMap<string, TestData>;
  /** uuid → TestData の高速引き当て用 map */
  testDataByUuid: ReadonlyMap<string, TestData>;
  isLoading: boolean;
};

export const buildCreatePdfTestDataMaps = (
  docs: readonly { data?: TestData }[],
): {
  byNo: ReadonlyMap<number, TestData>;
  byId: ReadonlyMap<string, TestData>;
  byUuid: ReadonlyMap<string, TestData>;
} => {
  const setByNo = new Map<number, TestData>();
  const setById = new Map<string, TestData>();
  const setByUuid = new Map<string, TestData>();

  if (docs.length === 0) {
    return {
      byNo: EMPTY_TEST_DATA_BY_NO,
      byId: EMPTY_TEST_DATA_BY_ID,
      byUuid: EMPTY_TEST_DATA_BY_UUID,
    };
  }

  for (const d of docs) {
    if (d.data) {
      if (typeof d.data.no === 'number') {
        setByNo.set(d.data.no, d.data);
      }
      if (d.data.id) {
        setById.set(d.data.id, d.data);
      }
      if (d.data.uuid) {
        setByUuid.set(d.data.uuid, d.data);
      }
    }
  }

  return { byNo: setByNo, byId: setById, byUuid: setByUuid };
};

/**
 * 選択中 grade に応じた TestData を購読し、snapshot builder が参照できる map を返す。
 * createPdf 専用。testDataEditor の UI store は一切参照しない。
 */
const useCreatePdfTestData = (grade: 1 | 2): CreatePdfTestDataResult => {
  const collectionPath = toGradeId(grade);
  const h = useTypedFirestoreHandler(collectionPath, {
    autoSubscribe: true,
  });
  const previousGradeRef = useRef(grade);
  const gradeChanged = previousGradeRef.current !== grade;

  useEffect(() => {
    previousGradeRef.current = grade;
  }, [grade]);

  const visibleDocs = gradeChanged || h.loading ? [] : h.docs;

  const testDataSet = useMemo(() => {
    return buildCreatePdfTestDataMaps(visibleDocs);
  }, [visibleDocs]);

  return {
    testDataSet,
    testDataByNo: testDataSet.byNo,
    testDataById: testDataSet.byId,
    testDataByUuid: testDataSet.byUuid,
    isLoading: gradeChanged || h.loading,
  };
};

export default useCreatePdfTestData;

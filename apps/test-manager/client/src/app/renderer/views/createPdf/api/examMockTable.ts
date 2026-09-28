import type { TestData } from '@shared/types/contracts';
import type { ExamCategoryTableRow } from '@views/createPdf/types/draftState';
import type { TestTableSection } from '@views/createPdf/types/testTable';
import { createCreatePdfId } from './common';

type TestSubject = TestData['subject'];

const normalizeExamSubject = (subject: string | null | undefined): string => {
  if (!subject) return '';
  return subject.replace('Ⅰ', 'I').replace('Ⅴ', 'V');
};

export const EXAM_SUBJECTS_BY_GRADE = {
  1: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ'],
  2: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ'],
} as const satisfies Record<1 | 2, readonly TestSubject[]>;

export const EXAM_REQUIRED_COUNTS_BY_GRADE = {
  1: {
    学科Ⅰ: 10,
    学科Ⅱ: 10,
    学科Ⅲ: 10,
    学科Ⅳ: 10,
    学科Ⅴ: 5,
  },
  2: {
    学科Ⅰ: 4,
    学科Ⅱ: 0,
    学科Ⅲ: 4,
    学科Ⅳ: 0,
  },
} as const satisfies Record<1 | 2, Partial<Record<TestSubject, number>>>;

const shuffle = <T>(items: readonly T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const getRequiredQuestionCount = (
  grade: 1 | 2,
  subject: TestSubject,
): number => {
  const counts = EXAM_REQUIRED_COUNTS_BY_GRADE[grade] as Partial<
    Record<TestSubject, number>
  >;
  return counts[subject] ?? 0;
};

export const getNextExamMockSubject = (
  grade: 1 | 2,
  categoryTable: ExamCategoryTableRow[],
): TestSubject | null => {
  const usedSubjects = new Set(
    categoryTable.flatMap((condition) =>
      condition.subject == null
        ? []
        : [normalizeExamSubject(condition.subject)],
    ),
  );
  return (
    EXAM_SUBJECTS_BY_GRADE[grade].find(
      (subject) => !usedSubjects.has(normalizeExamSubject(subject)),
    ) ?? null
  );
};

export const buildMockExamSection = (params: {
  grade: 1 | 2;
  frameCondition: ExamCategoryTableRow & { subject: TestSubject };
  testDataByNo: ReadonlyMap<number, TestData>;
}): TestTableSection => {
  const { grade, frameCondition, testDataByNo } = params;
  const requiredCount = getRequiredQuestionCount(grade, frameCondition.subject);
  const targetSubject = normalizeExamSubject(frameCondition.subject);
  const candidates = shuffle(
    [...testDataByNo.values()].filter(
      (testData) => normalizeExamSubject(testData.subject) === targetSubject,
    ),
  );
  const selected = candidates.slice(0, requiredCount);

  return {
    id: frameCondition.id,
    label: frameCondition.subject,
    subject: frameCondition.subject,
    rows: selected.map((testData) => ({
      id: createCreatePdfId('test-table-row'),
      sourceConditionId: frameCondition.id,
      categoryTable: [
        {
          id: createCreatePdfId('test-category-condition'),
          subject: frameCondition.subject,
          bigCategoryTag: testData.bigCategoryTag || null,
          smallCategoryTag: testData.smallCategoryTag || null,
        },
      ],
      selectedNo: String(testData.no),
      qaaChoiceIndex: null,
      isFixed: false,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    })),
    shortageCount:
      selected.length < requiredCount
        ? requiredCount - selected.length
        : undefined,
  };
};

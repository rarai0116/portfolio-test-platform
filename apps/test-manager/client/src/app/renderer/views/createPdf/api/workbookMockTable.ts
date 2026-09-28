import type { TestData, TestSubject } from '@shared/types/contracts';
import { createCreatePdfId } from '@views/createPdf/api/common';
import { createEmptyTestTableRow } from '@views/createPdf/api/testTableRows';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import type {
  WorkbookCategoryTableRow,
  WorkbookMode,
} from '@views/createPdf/types/viewState';

export type WorkbookMockSummary = {
  conditionId: string;
  subject: TestSubject | null;
  requestedCount: number;
  actualCount: number;
  shortageCount: number;
};

export const WORKBOOK_MOCK_SUBJECTS_BY_GRADE = {
  1: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ'],
  2: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ'],
} as const satisfies Record<1 | 2, readonly TestSubject[]>;

const normalizeSubject = (subject: string | null | undefined): string => {
  if (!subject) return '';
  return subject.replace('Ⅰ', 'I').replace('Ⅴ', 'V');
};

const shuffle = <T>(items: readonly T[]): T[] => {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

const getGradeChoiceIndices = (grade: 1 | 2): readonly number[] =>
  grade === 1 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];

const hasChoiceHtml = (source: TestData, choiceIndex: number): boolean => {
  const field = `ch${choiceIndex}` as const;
  return String(source[field] ?? '').trim().length > 0;
};

const pickRandomQaaChoiceIndex = (
  source: TestData,
  grade: 1 | 2,
): number | null => {
  const candidates = shuffle(getGradeChoiceIndices(grade));

  for (const choiceIndex of candidates) {
    if (hasChoiceHtml(source, choiceIndex)) {
      return choiceIndex;
    }
  }

  return null;
};

const createMockWorkbookRow = (params: {
  grade: 1 | 2;
  source: TestData;
  workbookMode: WorkbookMode;
  condition: WorkbookCategoryTableRow;
}): TestTableRow => {
  const { grade, source, workbookMode, condition } = params;
  const qaaChoiceIndex =
    workbookMode === 'multipleChoice'
      ? null
      : pickRandomQaaChoiceIndex(source, grade);

  return {
    ...createEmptyTestTableRow([
      {
        id: createCreatePdfId('test-category-condition'),
        subject: condition.subject,
        bigCategoryTag: condition.bigCategoryTag,
        smallCategoryTag: condition.smallCategoryTag,
      },
    ]),
    sourceConditionId: condition.id,
    selectedNo: String(source.no),
    qaaChoiceIndex,
  };
};

export const getNextWorkbookMockSubject = (
  grade: 1 | 2,
  conditions: WorkbookCategoryTableRow[],
): TestSubject | null => {
  const usedSubjects = new Set(
    conditions.flatMap((condition) =>
      condition.subject == null ? [] : [normalizeSubject(condition.subject)],
    ),
  );

  return (
    WORKBOOK_MOCK_SUBJECTS_BY_GRADE[grade].find(
      (subject) => !usedSubjects.has(normalizeSubject(subject)),
    ) ?? null
  );
};

export const buildWorkbookMockRows = (params: {
  grade: 1 | 2;
  workbookMode: WorkbookMode;
  conditions: WorkbookCategoryTableRow[];
  testDataByNo: ReadonlyMap<number, TestData>;
}): {
  rows: TestTableRow[];
  summaries: WorkbookMockSummary[];
} => {
  const { grade, workbookMode, conditions, testDataByNo } = params;
  const usedNos = new Set<number>();
  const rows: TestTableRow[] = [];
  const summaries: WorkbookMockSummary[] = [];

  for (const condition of conditions) {
    const requestedCount = Math.max(0, condition.count);
    const normalizedSubject = normalizeSubject(condition.subject);
    // qaa 系モードでは isConvertibleQaa=true の問題のみ候補にする
    const isQaaMode = workbookMode !== 'multipleChoice';
    const subjectCandidates = shuffle(
      [...testDataByNo.values()].filter(
        (testData) =>
          normalizeSubject(testData.subject) === normalizedSubject &&
          !usedNos.has(testData.no) &&
          (!isQaaMode || testData.isConvertibleQaa),
      ),
    );
    const selected = subjectCandidates.slice(0, requestedCount);

    selected.forEach((source) => {
      usedNos.add(source.no);
      rows.push(
        createMockWorkbookRow({
          grade,
          source,
          workbookMode,
          condition,
        }),
      );
    });

    summaries.push({
      conditionId: condition.id,
      subject: condition.subject as TestSubject | null,
      requestedCount,
      actualCount: selected.length,
      shortageCount: Math.max(0, requestedCount - selected.length),
    });
  }

  return { rows, summaries };
};

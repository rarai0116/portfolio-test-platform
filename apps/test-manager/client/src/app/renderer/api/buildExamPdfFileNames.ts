import type { TestSubject } from '@shared/types/contracts';

const questionGroupSpecsByGrade: Record<1 | 2, readonly TestSubject[][]> = {
  1: [['学科Ⅰ', '学科Ⅱ'], ['学科Ⅲ'], ['学科Ⅳ', '学科Ⅴ']],
  2: [
    ['学科Ⅰ', '学科Ⅱ'],
    ['学科Ⅲ', '学科Ⅳ'],
  ],
};

const answerSubjectsByGrade: Record<1 | 2, readonly TestSubject[]> = {
  1: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ'],
  2: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ'],
};

const answerSubjectLabelsByGrade: Record<1 | 2, Record<TestSubject, string>> = {
  1: {
    学科Ⅰ: '計画',
    学科Ⅱ: '環境・設備',
    学科Ⅲ: '法規',
    学科Ⅳ: '構造',
    学科Ⅴ: '施工',
  },
  2: {
    学科Ⅰ: '建築計画',
    学科Ⅱ: '建築法規',
    学科Ⅲ: '建築構造',
    学科Ⅳ: '建築施工',
    学科Ⅴ: '施工',
  },
};

export const normalizeExamPdfTitle = (title: string): string =>
  title.trim() || '模擬試験';

export const normalizeExamSubject = (
  subject: string | null | undefined,
): TestSubject | null => {
  if (!subject) {
    return null;
  }

  const normalized = subject.replace('V', 'Ⅴ');
  switch (normalized) {
    case '学科Ⅰ':
    case '学科Ⅱ':
    case '学科Ⅲ':
    case '学科Ⅳ':
    case '学科Ⅴ':
      return normalized;
    default:
      return null;
  }
};

const collectPresentSubjects = (
  subjects: readonly (string | null | undefined)[],
): TestSubject[] => {
  const result: TestSubject[] = [];
  const seen = new Set<TestSubject>();

  for (const subject of subjects) {
    const normalized = normalizeExamSubject(subject);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const formatQuestionGroupLabel = (subjects: readonly TestSubject[]): string => {
  const [first, ...rest] = subjects;
  if (!first) {
    return '未設定';
  }

  return [first, ...rest.map((subject) => subject.replace(/^学科/, ''))].join(
    '・',
  );
};

export const buildExamQuestionPdfFileName = ({
  subjects,
}: {
  subjects: readonly TestSubject[];
}): string => `問題用紙_${formatQuestionGroupLabel(subjects)}.pdf`;

export const buildExamAnswerPdfFileName = ({
  grade,
  subject,
}: {
  grade: 1 | 2;
  subject: TestSubject;
}): string =>
  `解説用紙_${subject}（${answerSubjectLabelsByGrade[grade][subject]}）.pdf`;

export const buildExpectedExamPdfFileNames = ({
  grade,
  subjects,
}: {
  grade: 1 | 2;
  subjects: readonly (string | null | undefined)[];
}): string[] => {
  const presentSubjects = collectPresentSubjects(subjects);
  const presentSubjectSet = new Set(presentSubjects);

  const questionFiles = questionGroupSpecsByGrade[grade]
    .map((group) => group.filter((subject) => presentSubjectSet.has(subject)))
    .filter((group) => group.length > 0)
    .map((group) => buildExamQuestionPdfFileName({ subjects: group }));

  const answerFiles = answerSubjectsByGrade[grade]
    .filter((subject) => presentSubjectSet.has(subject))
    .map((subject) => buildExamAnswerPdfFileName({ grade, subject }));

  return [...questionFiles, ...answerFiles];
};

import type { TestSubject } from '@shared/types/contracts';
import type {
  ExamAnswerCoverKey,
  ExamMiddleCoverKey,
  ExamQuestionCoverKey,
} from './examCoverAssetUrls';
import type { LayoutState } from './types';

type ExamNormalizedSubject = TestSubject;

export type ExamGroupedSubject = {
  subject: string;
  normalizedSubject: ExamNormalizedSubject;
};

export type ExamQuestionGroup = {
  id: string;
  label: string;
  coverKey: ExamQuestionCoverKey;
  subjects: ExamGroupedSubject[];
  middleCoverKey?: ExamMiddleCoverKey;
};

export type ExamAnswerGroup = {
  id: string;
  subject: string;
  normalizedSubject: ExamNormalizedSubject;
  coverKey: ExamAnswerCoverKey;
};

type QuestionGroupSpec = {
  id: string;
  coverKey: ExamQuestionCoverKey;
  subjects: readonly TestSubject[];
  middleCoverKey?: ExamMiddleCoverKey;
};

const questionGroupSpecs: Record<1 | 2, readonly QuestionGroupSpec[]> = {
  1: [
    {
      id: 'question-booklet-1',
      coverKey: 'cover1',
      subjects: ['学科Ⅰ', '学科Ⅱ'],
      middleCoverKey: 'middleCover1',
    },
    {
      id: 'question-booklet-2',
      coverKey: 'cover2',
      subjects: ['学科Ⅲ'],
      middleCoverKey: 'middleCover2',
    },
    {
      id: 'question-booklet-3',
      coverKey: 'cover3',
      subjects: ['学科Ⅳ', '学科Ⅴ'],
      middleCoverKey: 'middleCover2',
    },
  ],
  2: [
    {
      id: 'question-booklet-1',
      coverKey: 'cover1',
      subjects: ['学科Ⅰ', '学科Ⅱ'],
      middleCoverKey: 'middleCover1',
    },
    {
      id: 'question-booklet-2',
      coverKey: 'cover2',
      subjects: ['学科Ⅲ', '学科Ⅳ'],
      middleCoverKey: 'middleCover2',
    },
  ],
};

const answerGroupSpecs: Record<
  1 | 2,
  readonly { subject: ExamNormalizedSubject; coverKey: ExamAnswerCoverKey }[]
> = {
  1: [
    { subject: '学科Ⅰ', coverKey: 'cover1' },
    { subject: '学科Ⅱ', coverKey: 'cover2' },
    { subject: '学科Ⅲ', coverKey: 'cover3' },
    { subject: '学科Ⅳ', coverKey: 'cover4' },
    { subject: '学科Ⅴ', coverKey: 'cover5' },
  ],
  2: [
    { subject: '学科Ⅰ', coverKey: 'cover1' },
    { subject: '学科Ⅱ', coverKey: 'cover2' },
    { subject: '学科Ⅲ', coverKey: 'cover3' },
    { subject: '学科Ⅳ', coverKey: 'cover4' },
  ],
};

const normalizeSubject = (
  subject: string | null | undefined,
): ExamNormalizedSubject | null => {
  if (!subject) return null;

  const normalized = subject.replace('Ⅴ', 'Ⅴ');
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

const resolveGradeNumber = (state: LayoutState): 1 | 2 => {
  if (state.options.gradeNumber === 1 || state.options.gradeNumber === 2) {
    return state.options.gradeNumber;
  }

  const parsed = Number(
    state.options.meta?.grade?.replace(/[^0-9]/g, '') ?? '',
  );
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }

  throw new Error('Exam preview requires gradeNumber or meta.grade.');
};

const isNonNullable = <T>(value: T | null | undefined): value is T =>
  value != null;

export const buildExamPreviewGroups = (
  state: LayoutState,
): {
  questionGroups: ExamQuestionGroup[];
  answerGroups: ExamAnswerGroup[];
} => {
  const gradeNumber = resolveGradeNumber(state);
  const actualSubjectByNormalized = new Map<ExamNormalizedSubject, string>();

  for (const item of state.items) {
    const normalizedSubject = normalizeSubject(item.subject);
    if (!normalizedSubject) continue;
    if (!actualSubjectByNormalized.has(normalizedSubject)) {
      actualSubjectByNormalized.set(normalizedSubject, item.subject);
    }
  }

  // 問題冊子ごとの境界をここで固定しておくと、後続の pageRanges 切り出しでも再利用しやすい。
  const questionGroups = questionGroupSpecs[gradeNumber]
    .map<ExamQuestionGroup | null>((spec) => {
      const subjects = spec.subjects
        .map<ExamGroupedSubject | null>((normalizedSubject) => {
          const subject = actualSubjectByNormalized.get(normalizedSubject);
          return subject ? { subject, normalizedSubject } : null;
        })
        .filter(isNonNullable);

      if (subjects.length === 0) {
        return null;
      }

      return {
        id: spec.id,
        label: subjects.map((subject) => subject.subject).join('・'),
        coverKey: spec.coverKey,
        subjects,
        middleCoverKey: spec.middleCoverKey,
      };
    })
    .filter(isNonNullable);

  const answerGroups = answerGroupSpecs[gradeNumber]
    .map<ExamAnswerGroup | null>((spec) => {
      const subject = actualSubjectByNormalized.get(spec.subject);
      if (!subject) {
        return null;
      }

      return {
        id: `answer-booklet-${spec.subject}`,
        subject,
        normalizedSubject: spec.subject,
        coverKey: spec.coverKey,
      };
    })
    .filter(isNonNullable);

  return {
    questionGroups,
    answerGroups,
  };
};

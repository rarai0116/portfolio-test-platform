import type { ExamDateOption } from '@shared/types/createPdfConditionJson';

export const EMPTY_EXAM_DATE: ExamDateOption = {
  year: '',
  month: '',
  day: '',
};

const DISPLAY_EMPTY_YEAR = '　　　　';
const DISPLAY_EMPTY_MONTH_OR_DAY = '　　';

export const normalizeExamDateOption = (
  value: Partial<ExamDateOption> | null | undefined,
): ExamDateOption => ({
  year: typeof value?.year === 'string' ? value.year : '',
  month: typeof value?.month === 'string' ? value.month : '',
  day: typeof value?.day === 'string' ? value.day : '',
});

export const toExamDateDisplayParts = (
  value: Partial<ExamDateOption> | null | undefined,
): ExamDateOption => {
  const normalized = normalizeExamDateOption(value);
  return {
    year: normalized.year || DISPLAY_EMPTY_YEAR,
    month: normalized.month || DISPLAY_EMPTY_MONTH_OR_DAY,
    day: normalized.day || DISPLAY_EMPTY_MONTH_OR_DAY,
  };
};

export const buildExamYearGradeText = (
  gradeLabel: string,
  value: Partial<ExamDateOption> | null | undefined,
): string => {
  const gradeText = gradeLabel.endsWith('級') ? gradeLabel : `${gradeLabel}級`;
  return `${toExamDateDisplayParts(value).year}年度${gradeText}建築士`;
};

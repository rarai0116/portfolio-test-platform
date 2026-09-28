import { buildExamYearGradeText } from '@renderer/api/examDateOption';
import type { TestSubject } from '@shared/types/contracts';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import {
  type ExamAnswerCoverKey,
  examAnswerCoverUrls,
  subjectSirializer,
} from './examCoverAssetUrls';

type AddExamAnswerCoverParams = {
  root: Document;
  answerContainer: HTMLElement;
  groupId: string;
  subject: TestSubject;
  title: string;
  gradeLabel: string;
  coverKey: ExamAnswerCoverKey;
  examDate?: ExamDateOption;
};

export const addExamAnswerCover = ({
  root,
  answerContainer,
  groupId,
  subject,
  title,
  gradeLabel,
  coverKey,
  examDate,
}: AddExamAnswerCoverParams): number => {
  const template = root.getElementById('tmp-answer-title');
  if (!template) {
    throw new Error('tmp-answer-title template not found');
  }

  const coverSection = template.firstElementChild;
  if (!coverSection) {
    throw new Error('tmp-answer-title template is missing its section');
  }

  const cloned = coverSection.cloneNode(true) as HTMLElement;
  cloned.id = `answer-cover-${groupId}`;
  cloned.classList.remove('tmp');
  cloned.dataset.previewGroupId = groupId;
  cloned.dataset.previewGroupKind = 'answer';
  cloned.dataset.previewCoverRole = 'cover';
  cloned.dataset.previewSubject = subject;

  const yearGradeEl = cloned.querySelector(
    '.cover-year-grade',
  ) as HTMLElement | null;
  const titleEl = cloned.querySelector('.title') as HTMLElement | null;
  const schoolEl = cloned.querySelector('.school') as HTMLElement | null;
  const kindEl = cloned.querySelector('.cover-kind') as HTMLElement | null;
  const subjectEl = cloned.querySelector(
    '.cover-subject',
  ) as HTMLElement | null;

  if (yearGradeEl)
    yearGradeEl.textContent = buildExamYearGradeText(gradeLabel, examDate);
  if (titleEl && title.length > 0) titleEl.textContent = title;
  if (schoolEl) schoolEl.textContent = import.meta.env.VITE_SCHOOL_NAME || '';
  if (kindEl) kindEl.textContent = '解説';
  if (subjectEl) {
    subjectEl.innerHTML = subjectSirializer(
      gradeLabel === '1級' || gradeLabel === '1' ? 1 : 2,
      subject,
    );
  }

  const image = cloned.querySelector('[data-cover-image="answer-cover"]');
  if (image) {
    (image as HTMLImageElement).src = examAnswerCoverUrls[coverKey];
    (image as HTMLImageElement).alt = `${subject} 解説表紙`;
  }

  answerContainer.appendChild(cloned);
  return 1;
};

import {
  buildExamYearGradeText,
  toExamDateDisplayParts,
} from '@renderer/api/examDateOption';
import type { TestSubject } from '@shared/types/contracts';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import {
  type ExamMiddleCoverKey,
  type ExamQuestionCoverKey,
  examMiddleCoverUrls,
  examQuestionCoverUrls,
  subjectSirializer,
} from './examCoverAssetUrls';

type AddExamCoverParams = {
  root: Document;
  questionContainer: HTMLElement;
  groupId: string;
  label: string;
  subjects: TestSubject[];
  title: string;
  gradeLabel: string;
  coverKey: ExamQuestionCoverKey | ExamMiddleCoverKey;
  coverKind: 'question' | 'answer';
  coverRole?: 'cover' | 'middle';
  includeBlankPage?: boolean;
  subject?: string;
  examDate?: ExamDateOption;
};

const applyCommonCoverText = (
  section: HTMLElement,
  params: Pick<
    AddExamCoverParams,
    'label' | 'title' | 'gradeLabel' | 'coverKind' | 'subjects' | 'examDate'
  >,
) => {
  const yearGradeEl = section.querySelector(
    '.cover-year-grade',
  ) as HTMLElement | null;
  const titleEl = section.querySelector('.title') as HTMLElement | null;
  const schoolEl = section.querySelector('.school') as HTMLElement | null;
  const kindEl = section.querySelector('.cover-kind') as HTMLElement | null;
  const subjectEl = section.querySelector(
    '.cover-subject',
  ) as HTMLElement | null;
  const choiceCountEl = section.querySelector(
    '.choice-count-display',
  ) as HTMLElement | null;
  const warningSpanYear = section.querySelector(
    '.warning-span-year',
  ) as HTMLElement | null;
  const dateEl = section.querySelector('.date') as HTMLElement | null;
  const gradeEl = section.querySelector('.q-num') as HTMLElement | null;

  if (yearGradeEl)
    yearGradeEl.textContent = buildExamYearGradeText(
      params.gradeLabel,
      params.examDate,
    );
  if (titleEl && params.title.length > 0) titleEl.textContent = params.title;
  if (schoolEl) schoolEl.textContent = import.meta.env.VITE_SCHOOL_NAME || '';
  if (kindEl)
    kindEl.textContent = params.coverKind === 'question' ? '問題' : '解説';
  console.warn('ラベル', params.gradeLabel);
  if (choiceCountEl)
    choiceCountEl.textContent =
      params.gradeLabel === '1級' ? '四枝択一式' : '五枝択一式';
  if (warningSpanYear)
    warningSpanYear.textContent = toExamDateDisplayParts(
      params.examDate,
    ).year;
  if (dateEl) {
    const displayDate = toExamDateDisplayParts(params.examDate);
    dateEl.textContent = `${displayDate.year}年${displayDate.month}月${displayDate.day}日実施`;
  }

  if (subjectEl) {
    subjectEl.innerHTML = params.subjects.reduce((prev, subject) => {
      const serialized = subjectSirializer(
        params.gradeLabel === '1級' ? 1 : 2,
        subject,
      );
      return prev ? `${prev}<br>${serialized}` : serialized;
    }, '');
  }

  if (gradeEl) gradeEl.textContent = params.gradeLabel;
};

export const addExamCover = ({
  root,
  questionContainer,
  groupId,
  label,
  title,
  gradeLabel,
  coverKey,
  coverKind,
  subjects,
  coverRole = 'cover',
  includeBlankPage = coverRole === 'cover',
  subject,
  examDate,
}: AddExamCoverParams): number => {
  const template = root.getElementById('tmp-title');
  if (!template) {
    throw new Error('tmp-title template not found');
  }

  const templateRoot = template.cloneNode(true) as HTMLElement;
  const sections = Array.from(templateRoot.children) as HTMLElement[];

  const [coverSection, blankSection] = sections;
  if (!coverSection || !blankSection) {
    throw new Error('tmp-title template is missing expected sections');
  }

  const isMiddleCover = coverRole === 'middle';

  coverSection.id = isMiddleCover
    ? `question-middle-cover-${groupId}-${subject ?? subjects[0]}`
    : `question-cover-${groupId}`;
  coverSection.classList.remove('tmp');
  coverSection.dataset.previewGroupId = groupId;
  coverSection.dataset.previewGroupKind = 'question';
  coverSection.dataset.previewCoverRole = isMiddleCover ? 'middle' : 'cover';
  if (subject) {
    coverSection.dataset.previewSubject = subject;
  }
  applyCommonCoverText(coverSection, {
    label,
    title,
    gradeLabel,
    coverKind,
    subjects,
    examDate,
  });

  const image = coverSection.querySelector(
    '[data-cover-image="question-cover"]',
  );
  if (image) {
    image.setAttribute(
      'data-cover-image',
      isMiddleCover ? 'question-middle-cover' : 'question-cover',
    );
    (image as HTMLImageElement).src = isMiddleCover
      ? examMiddleCoverUrls[coverKey as ExamMiddleCoverKey]
      : examQuestionCoverUrls[coverKey as ExamQuestionCoverKey];
    (image as HTMLImageElement).alt = isMiddleCover
      ? `${label} 問題用紙中表紙`
      : `${label} 問題用紙表紙`;
  }

  questionContainer.appendChild(coverSection);

  if (!includeBlankPage) {
    return 1;
  }

  blankSection.id = `question-cover-blank-${groupId}`;
  blankSection.classList.remove('tmp');
  blankSection.dataset.previewGroupId = groupId;
  blankSection.dataset.previewGroupKind = 'question';
  blankSection.dataset.previewCoverRole = 'blank';

  questionContainer.appendChild(blankSection);
  return 2;
};

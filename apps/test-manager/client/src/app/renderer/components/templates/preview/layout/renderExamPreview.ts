import { addExamAnswerCover } from './addExamAnswerCover';
import { addExamCover } from './addExamCover';
import { buildExamPreviewGroups } from './buildExamPreviewGroups';
import { paginateArea } from './paginateArea';
import type { LayoutState, PageMapEntry } from './types';

const getRequiredElement = (root: Document, id: string) => {
  const element = root.getElementById(id);
  console.log(element, `Element with id ${id} should exist in the document.`);
  if (!element) {
    throw new Error(`${id} not found`);
  }
  return element;
};

const resolveGradeLabel = (state: LayoutState) => {
  if (state.options.gradeNumber === 1 || state.options.gradeNumber === 2) {
    return `${state.options.gradeNumber}級`;
  }
  if (state.options.meta?.grade) {
    return state.options.meta.grade;
  }
  throw new Error('Exam preview requires grade information.');
};

const markRenderedSections = (
  container: HTMLElement,
  startIndex: number,
  payload: {
    groupId: string;
    kind: 'question' | 'answer';
    subject: string;
  },
) => {
  const rendered = Array.from(
    container.children as HTMLCollectionOf<HTMLElement>,
  ).slice(startIndex);
  rendered.forEach((node) => {
    if (!node) return;
    node.dataset.previewGroupId = payload.groupId;
    node.dataset.previewGroupKind = payload.kind;
    node.dataset.previewPrefix = payload.kind;
    node.dataset.previewSubject = payload.subject;
  });

  return rendered.length;
};

const paginateSubjectArea = async ({
  root,
  container,
  areaId,
  prefix,
  pageMapByItemId,
  groupId,
  subject,
  resetPageCounter = false,
}: {
  root: Document;
  container: HTMLElement;
  areaId: string;
  prefix: 'question' | 'answer';
  pageMapByItemId: Map<string, PageMapEntry>;
  groupId: string;
  subject: string;
  resetPageCounter?: boolean;
}) => {
  const area = root.getElementById(areaId);
  if (!area || area.children.length === 0) {
    return 0;
  }

  const startIndex = container.children.length;
  const nextPage = await paginateArea({
    areaNodes: area.children,
    prefix,
    root,
    pageMapByItemId,
    resetPageCount: resetPageCounter,
  });

  // 冊子境界を DOM に残しておくと、後続の pageRanges 切り出しで再走査しやすい。
  markRenderedSections(container, startIndex, {
    groupId,
    kind: prefix,
    subject,
  });

  return Math.max(0, nextPage - 1);
};

export const renderExamPreview = async ({
  root,
  state,
  pageMapByItemId,
}: {
  root: Document;
  state: LayoutState;
  pageMapByItemId: Map<string, PageMapEntry>;
}) => {
  const titleContainer = root.getElementById('title-container');
  if (titleContainer) {
    titleContainer.innerHTML = '';
  }

  console.log(
    'Rendering exam preview with state:',
    state,
    root,
    pageMapByItemId,
  );
  const questionContainer = getRequiredElement(root, 'question-container');
  const answerContainer = getRequiredElement(root, 'answer-container');
  questionContainer.innerHTML = '';
  answerContainer.innerHTML = '';

  const { questionGroups, answerGroups } = buildExamPreviewGroups(state);
  const title = state.options.meta?.title?.trim() || '模擬試験';
  const gradeLabel = resolveGradeLabel(state);
  const { examDate } = state.options;
  let totalPages = 0;

  if (state.options.mode !== 'onlyAnswer') {
    for (const questionGroup of questionGroups) {
      totalPages += addExamCover({
        root,
        questionContainer,
        groupId: questionGroup.id,
        label: questionGroup.label,
        subjects: questionGroup.subjects.map((s) => s.normalizedSubject),
        title,
        gradeLabel,
        coverKey: questionGroup.coverKey,
        coverKind: 'question',
        examDate,
      });

      let shouldResetQuestionCounter = true;
      for (const subject of questionGroup.subjects) {
        const middleCoverKey = questionGroup.middleCoverKey;
        const hasMiddleCover = Boolean(middleCoverKey);

        // 中表紙(単学科の時は中表紙を表示しない)
        if (middleCoverKey && questionGroup.subjects.length > 1) {
          totalPages += addExamCover({
            root,
            questionContainer,
            groupId: questionGroup.id,
            label: `${subject.subject}（中間）`,
            coverKind: 'question',
            subjects: [subject.normalizedSubject],
            title,
            gradeLabel,
            coverKey: middleCoverKey,
            coverRole: 'middle',
            includeBlankPage: false,
            subject: subject.subject,
            examDate,
          });
        }

        totalPages += await paginateSubjectArea({
          root,
          container: questionContainer,
          areaId: `question-area-${subject.subject}`,
          prefix: 'question',
          pageMapByItemId,
          groupId: questionGroup.id,
          subject: subject.subject,
          resetPageCounter: shouldResetQuestionCounter || hasMiddleCover,
        });
        shouldResetQuestionCounter = false;
      }
    }
  }

  if (state.options.mode !== 'onlyQuestion') {
    for (const answerGroup of answerGroups) {
      totalPages += addExamAnswerCover({
        root,
        answerContainer,
        groupId: answerGroup.id,
        subject: answerGroup.normalizedSubject,
        title,
        gradeLabel,
        coverKey: answerGroup.coverKey,
        examDate,
      });
      totalPages += await paginateSubjectArea({
        root,
        container: answerContainer,
        areaId: `answer-area-${answerGroup.subject}`,
        prefix: 'answer',
        pageMapByItemId,
        groupId: answerGroup.id,
        subject: answerGroup.normalizedSubject,
        resetPageCounter: true,
      });
    }
  }

  return totalPages;
};

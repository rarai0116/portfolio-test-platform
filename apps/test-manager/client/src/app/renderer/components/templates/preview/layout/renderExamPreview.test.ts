import { beforeEach, describe, expect, it, vi } from 'vitest';
import viewerExamHtml from '../viewer-exam.html?raw';
import { configureBySubject, layoutTmpTest } from './fullRenderPreview';
import { renderExamPreview } from './renderExamPreview';
import type { LayoutState, PreviewItem } from './types';

const { paginateAreaMock } = vi.hoisted(() => ({
  paginateAreaMock: vi.fn(),
}));

vi.mock('./paginateArea', () => ({
  paginateArea: paginateAreaMock,
}));

const buildItem = (
  subject: string,
  overrides: Partial<PreviewItem> = {},
): PreviewItem => ({
  id: `item-${subject}`,
  subject,
  bigCategoryTag: '大分類A',
  smallCategoryTag: '小分類A',
  nengo: '令和',
  year: 6,
  testNo: '01',
  textHtml: '<p>問題文</p>',
  questionChoicesHtml: ['<p>選択肢</p>'],
  answerTextHtml: '<p>解説文</p>',
  answerChoicesHtml: ['<p>解答選択肢</p>'],
  answerBool: true,
  answerNo: '1',
  difficult: 1,
  ...overrides,
});

const buildState = (): LayoutState => ({
  options: {
    mode: 'both',
    hasCover: true,
    hasSubCategoryHeading: false,
    questionCount: 5,
    meta: {
      title: '模擬試験',
      grade: '1級',
    },
    page: {
      size: 'A4',
      pxPerMm: 0.2645,
      baseHeightMm: 287,
    },
    questionEditorType: 'normal',
    answerEditorType: 'normal',
    creationType: 'exam',
    gradeNumber: 1,
    examDate: { year: '', month: '', day: '' },
  },
  items: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ'].map((subject, index) =>
    buildItem(subject, { id: `item-${index + 1}` }),
  ),
});

const loadViewerDocument = () => {
  document.open();
  document.write(viewerExamHtml);
  document.close();
};

describe('renderExamPreview', () => {
  beforeEach(() => {
    paginateAreaMock.mockReset();
    loadViewerDocument();

    paginateAreaMock.mockImplementation(
      async ({ areaNodes, prefix, root, resetPageCount }) => {
        const container = root.getElementById(`${prefix}-container`);
        if (!(container instanceof HTMLElement)) {
          throw new Error(`${prefix}-container not found`);
        }

        const section = root.createElement('section');
        section.className = 'print-page';
        if (resetPageCount) {
          section.classList.add('page-counter-reset');
        }
        Array.from(areaNodes).forEach((node) => {
          section.appendChild((node as HTMLElement).cloneNode(true));
        });
        container.appendChild(section);
        return 2;
      },
    );
  });

  it('問題冊子と解説冊子の cover を仕様順で挿し込む', async () => {
    const root = document;
    const pageMapByItemId = new Map();
    const state = buildState();

    await layoutTmpTest(state, root, configureBySubject(state));

    for (const item of state.items) {
      pageMapByItemId.set(item.id, {
        itemId: item.id,
        subject: item.subject,
        smallCategory: item.smallCategoryTag,
        questionIndex: 1,
      });
    }

    const totalPages = await renderExamPreview({
      root,
      state,
      pageMapByItemId,
    });

    const questionContainer = document.getElementById('question-container');
    const answerContainer = document.getElementById('answer-container');
    if (!(questionContainer instanceof HTMLElement)) {
      throw new Error('question-container not found');
    }
    if (!(answerContainer instanceof HTMLElement)) {
      throw new Error('answer-container not found');
    }

    expect(totalPages).toBe(25);
    expect(
      questionContainer.querySelectorAll('[data-cover-image="question-cover"]'),
    ).toHaveLength(3);
    expect(
      questionContainer.querySelectorAll(
        '[data-cover-image="question-middle-cover"]',
      ),
    ).toHaveLength(4);
    expect(
      answerContainer.querySelectorAll('[data-cover-image="answer-cover"]'),
    ).toHaveLength(5);

    const questionCoverSrcs = Array.from(
      questionContainer.querySelectorAll('[data-cover-image="question-cover"]'),
    ).map((node) => (node as HTMLImageElement).src);
    expect(questionCoverSrcs[0]).toContain('cover1.png');
    expect(questionCoverSrcs[1]).toContain('cover2.png');
    expect(questionCoverSrcs[2]).toContain('cover3.png');

    const middleCoverSrcs = Array.from(
      questionContainer.querySelectorAll(
        '[data-cover-image="question-middle-cover"]',
      ),
    ).map((node) => (node as HTMLImageElement).src);
    expect(middleCoverSrcs[0]).toContain('middleCover1.png');
    expect(middleCoverSrcs[1]).toContain('middleCover1.png');
    expect(middleCoverSrcs[2]).toContain('middleCover2.png');
    expect(middleCoverSrcs[3]).toContain('middleCover2.png');

    const questionNodes = Array.from(questionContainer.children).map((node) => {
      const element = node as HTMLElement;
      return {
        role: element.dataset.previewCoverRole ?? 'page',
        subject: element.dataset.previewSubject ?? '',
        groupId: element.dataset.previewGroupId ?? '',
      };
    });

    expect(
      questionNodes.findIndex(
        (node) =>
          node.role === 'middle' &&
          node.subject === '学科Ⅰ' &&
          node.groupId === 'question-booklet-1',
      ),
    ).toBeLessThan(
      questionNodes.findIndex(
        (node) =>
          node.role === 'page' &&
          node.subject === '学科Ⅰ' &&
          node.groupId === 'question-booklet-1',
      ),
    );
    expect(
      questionNodes.findIndex(
        (node) =>
          node.role === 'middle' &&
          node.subject === '学科Ⅱ' &&
          node.groupId === 'question-booklet-1',
      ),
    ).toBeGreaterThan(
      questionNodes.findIndex(
        (node) =>
          node.role === 'page' &&
          node.subject === '学科Ⅰ' &&
          node.groupId === 'question-booklet-1',
      ),
    );
    expect(
      questionNodes.findIndex(
        (node) =>
          node.role === 'middle' &&
          node.subject === '学科Ⅱ' &&
          node.groupId === 'question-booklet-1',
      ),
    ).toBeLessThan(
      questionNodes.findIndex(
        (node) =>
          node.role === 'page' &&
          node.subject === '学科Ⅱ' &&
          node.groupId === 'question-booklet-1',
      ),
    );
    expect(
      questionNodes.findIndex(
        (node) =>
          node.role === 'middle' &&
          node.subject === '学科Ⅲ' &&
          node.groupId === 'question-booklet-2',
      ),
    ).toBeLessThan(
      questionNodes.findIndex(
        (node) =>
          node.role === 'page' &&
          node.subject === '学科Ⅲ' &&
          node.groupId === 'question-booklet-2',
      ),
    );

    const answerCoverSrcs = Array.from(
      answerContainer.querySelectorAll('[data-cover-image="answer-cover"]'),
    ).map((node) => (node as HTMLImageElement).src);
    expect(answerCoverSrcs).toHaveLength(5);
    expect(answerCoverSrcs[0]).toContain('cover1.png');
    expect(answerCoverSrcs[1]).toContain('cover2.png');
    expect(answerCoverSrcs[2]).toContain('cover3.png');
    expect(answerCoverSrcs[3]).toContain('cover4.png');
    expect(answerCoverSrcs[4]).toContain('cover5.png');

    expect(
      questionContainer.querySelectorAll('[data-preview-cover-role="blank"]'),
    ).toHaveLength(3);
    expect(
      questionContainer.querySelectorAll('[data-preview-prefix="question"]'),
    ).toHaveLength(5);
    expect(
      answerContainer.querySelectorAll('[data-preview-prefix="answer"]'),
    ).toHaveLength(5);

    const firstQuestionPage = questionContainer.querySelector(
      'section.print-page.page-counter-reset:not(.blank-page)',
    );
    expect(firstQuestionPage).not.toBeNull();

    const resetQuestionPages = Array.from(
      questionContainer.querySelectorAll(
        'section.print-page.page-counter-reset:not(.blank-page)',
      ),
    ) as HTMLElement[];
    expect(resetQuestionPages).toHaveLength(5);
    expect(
      resetQuestionPages.some(
        (page) =>
          page.dataset.previewGroupId === 'question-booklet-1' &&
          page.dataset.previewSubject === '学科Ⅰ',
      ),
    ).toBe(true);
    expect(
      resetQuestionPages.some(
        (page) =>
          page.dataset.previewGroupId === 'question-booklet-1' &&
          page.dataset.previewSubject === '学科Ⅱ',
      ),
    ).toBe(true);

    const resetAnswerPages = Array.from(
      answerContainer.querySelectorAll(
        'section.print-page.page-counter-reset:not(.blank-page)',
      ),
    ) as HTMLElement[];
    expect(resetAnswerPages).toHaveLength(5);
    expect(
      resetAnswerPages.some(
        (page) =>
          page.dataset.previewGroupId === 'answer-booklet-学科Ⅱ' &&
          page.dataset.previewSubject === '学科Ⅱ',
      ),
    ).toBe(true);
  });

  it('各学科の先頭問題・解説に学科見出しを差し込む', async () => {
    const root = document;
    const pageMapByItemId = new Map();
    const state = buildState();

    await layoutTmpTest(state, root, configureBySubject(state));

    for (const item of state.items) {
      pageMapByItemId.set(item.id, {
        itemId: item.id,
        subject: item.subject,
        smallCategory: item.smallCategoryTag,
        questionIndex: 1,
      });
    }

    await renderExamPreview({
      root,
      state,
      pageMapByItemId,
    });

    const questionContainer = document.getElementById('question-container');
    const answerContainer = document.getElementById('answer-container');
    if (!(questionContainer instanceof HTMLElement)) {
      throw new Error('question-container not found');
    }
    if (!(answerContainer instanceof HTMLElement)) {
      throw new Error('answer-container not found');
    }

    expect(
      questionContainer.querySelector(
        'section[data-preview-subject="学科Ⅰ"] .question-sub-title',
      )?.textContent,
    ).toBe('学科Ⅰ（計画）');

    expect(
      answerContainer.querySelector(
        'section[data-preview-subject="学科Ⅰ"] .answer-sub-title',
      )?.textContent,
    ).toBe('学科Ⅰ（計画）解説');
  });

  it('実施年月日を問題表紙・中表紙・解説表紙に反映する', async () => {
    const root = document;
    const pageMapByItemId = new Map();
    const state = {
      ...buildState(),
      options: {
        ...buildState().options,
        examDate: { year: '2026', month: '', day: '1' },
      },
    };

    await layoutTmpTest(state, root, configureBySubject(state));

    for (const item of state.items) {
      pageMapByItemId.set(item.id, {
        itemId: item.id,
        subject: item.subject,
        smallCategory: item.smallCategoryTag,
        questionIndex: 1,
      });
    }

    await renderExamPreview({
      root,
      state,
      pageMapByItemId,
    });

    const questionCover = document.querySelector(
      '#question-container [data-preview-cover-role="cover"]',
    );
    const middleCover = document.querySelector(
      '#question-container [data-preview-cover-role="middle"]',
    );
    const answerCover = document.querySelector(
      '#answer-container [data-preview-cover-role="cover"]',
    );

    expect(questionCover?.querySelector('.cover-year-grade')?.textContent).toBe(
      '2026年度1級建築士',
    );
    expect(questionCover?.querySelector('.warning-span-year')?.textContent).toBe(
      '2026',
    );
    expect(questionCover?.querySelector('.date')?.textContent).toBe(
      '2026年　　月1日実施',
    );
    expect(middleCover?.querySelector('.cover-year-grade')?.textContent).toBe(
      '2026年度1級建築士',
    );
    expect(answerCover?.querySelector('.cover-year-grade')?.textContent).toBe(
      '2026年度1級建築士',
    );
  });

  it('実施年月日が空文字の場合は表紙に全角空白を反映する', async () => {
    const root = document;
    const pageMapByItemId = new Map();
    const state = buildState();

    await layoutTmpTest(state, root, configureBySubject(state));

    for (const item of state.items) {
      pageMapByItemId.set(item.id, {
        itemId: item.id,
        subject: item.subject,
        smallCategory: item.smallCategoryTag,
        questionIndex: 1,
      });
    }

    await renderExamPreview({
      root,
      state,
      pageMapByItemId,
    });

    const questionCover = document.querySelector(
      '#question-container [data-preview-cover-role="cover"]',
    );

    expect(questionCover?.querySelector('.cover-year-grade')?.textContent).toBe(
      '　　　　年度1級建築士',
    );
    expect(questionCover?.querySelector('.warning-span-year')?.textContent).toBe(
      '　　　　',
    );
    expect(questionCover?.querySelector('.date')?.textContent).toBe(
      '　　　　年　　月　　日実施',
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageAssetMap } from '@stores/useImageAssetStore';
import viewerHtml from '../viewer.html?raw';
import type { LayoutState, PreviewItem } from './types';

type PaginationPlan = {
  questionPages: number;
  answerPages: number;
};

const { paginateAreaMock, paginationPlan, realizeHtmlImagesMock } = vi.hoisted(
  () => ({
    paginateAreaMock: vi.fn(),
    paginationPlan: {
      questionPages: 1,
      answerPages: 1,
    } satisfies PaginationPlan,
    realizeHtmlImagesMock: vi.fn((html: string) => html),
  }),
);

vi.mock('./paginateArea', () => ({
  paginateArea: paginateAreaMock,
}));

vi.mock('../imageRealizer', () => ({
  realizeHtmlImages: realizeHtmlImagesMock,
}));

const buildItem = (overrides: Partial<PreviewItem> = {}): PreviewItem => ({
  id: 'item-1',
  subject: '学科Ⅰ',
  bigCategoryTag: '大分類A',
  smallCategoryTag: '小分類A',
  nengo: '令和',
  year: 6,
  testNo: '01',
  textHtml: '<p>問題文</p>',
  questionChoicesHtml: [],
  answerTextHtml: '<p>解説文</p>',
  answerChoicesHtml: [],
  answerBool: true,
  answerNo: '1',
  difficult: 1,
  ...overrides,
});

const buildState = (
  optionOverrides: Partial<LayoutState['options']> = {},
  itemOverrides: Partial<PreviewItem> = {},
): LayoutState => ({
  options: {
    mode: 'both',
    hasCover: true,
    hasSubCategoryHeading: true,
    questionCount: 1,
    meta: {
      title: 'テスト問題集',
      subject: '学科Ⅰ',
      grade: '1級',
    },
    page: {
      size: 'B5',
      pxPerMm: 0.2645,
      baseHeightMm: 235,
    },
    questionEditorType: 'normal',
    answerEditorType: 'normal',
    creationType: 'workbook',
    workbookMode: 'multipleChoice',
    ...optionOverrides,
  },
  items: [buildItem(itemOverrides)],
});

const loadViewerDocument = () => {
  document.open();
  document.write(viewerHtml);
  document.close();
  return document;
};

const installPaginateAreaMock = () => {
  paginateAreaMock.mockImplementation(
    async ({ areaNodes, prefix, root, pageMapByItemId }) => {
      const container = root.getElementById(`${prefix}-container`);
      if (!container) {
        throw new Error(`${prefix}-container not found`);
      }

      container.innerHTML = '';
      const pageCount =
        prefix === 'question'
          ? paginationPlan.questionPages
          : paginationPlan.answerPages;

      const firstHeading = Array.from(areaNodes).find((node) =>
        (node as HTMLElement).classList.contains('subcategory-name'),
      ) as HTMLElement | undefined;

      for (const entry of pageMapByItemId.values()) {
        if (prefix === 'question' && entry.questionPage === undefined) {
          entry.questionPage = 1;
        }
        if (prefix === 'answer' && entry.answerPage === undefined) {
          entry.answerPage = 1;
        }
        pageMapByItemId.set(entry.itemId, entry);
      }

      for (let index = 0; index < pageCount; index++) {
        const section = root.createElement('section');
        section.classList.add('print-page');

        if (index === 0 && firstHeading) {
          section.appendChild(firstHeading.cloneNode(true));
        }

        container.appendChild(section);
      }

      return pageCount + 1;
    },
  );
};

const renderLayout = async (state: LayoutState, images?: ImageAssetMap) => {
  vi.resetModules();
  loadViewerDocument();
  installPaginateAreaMock();

  const module = await import('./fullRenderPreview');
  const bySubject = module.configureBySubject(state);

  await module.layoutTmpTest(state, document, bySubject, images);
  const totalPages = await module.adjustTestArea(document, bySubject, state);

  return { totalPages };
};

const getTocPageTexts = () => {
  const title = document.getElementById('title-学科Ⅰ');
  if (!title) return [];

  return Array.from(title.querySelectorAll('.page-div')).map(
    (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
};

describe('fullRenderPreview の目次ページ算定', () => {
  beforeEach(() => {
    paginationPlan.questionPages = 1;
    paginationPlan.answerPages = 1;
    paginateAreaMock.mockReset();
    realizeHtmlImagesMock.mockClear();
  });

  it('表紙ありでは表紙後の空白ページを1ページとして加算する', async () => {
    const { totalPages } = await renderLayout(buildState({ hasCover: true }));

    expect(totalPages).toBe(3);
    expect(getTocPageTexts()).toEqual(['P.2', '(P.3)']);
  });

  it('表紙なしでは空白ページを総ページ数に加算しない', async () => {
    const { totalPages } = await renderLayout(buildState({ hasCover: false }));

    expect(totalPages).toBe(2);
    expect(document.querySelectorAll('.page-wrapper')).toHaveLength(0);
  });

  it('複数ページにまたがる小分類は範囲表記で表示する', async () => {
    paginationPlan.questionPages = 2;
    paginationPlan.answerPages = 2;

    const { totalPages } = await renderLayout(buildState({ hasCover: true }));

    expect(totalPages).toBe(5);
    expect(getTocPageTexts()).toEqual(['P.2〜P.3', '(P.4〜P.5)']);
  });

  it('解説のみでは空の問題ページを生成しない', async () => {
    const { totalPages } = await renderLayout(
      buildState({ hasCover: false, mode: 'onlyAnswer' }),
    );

    expect(totalPages).toBe(1);
    expect(paginateAreaMock).toHaveBeenCalledTimes(1);
    expect(paginateAreaMock.mock.calls[0]?.[0].prefix).toBe('answer');
  });

  it('HTML画像が事前解決済みのときは再解決しない', async () => {
    await renderLayout({
      ...buildState(
        { hasCover: false },
        {
          textHtml: '<p>問題文<img alt="imageKey" /></p>',
          answerTextHtml: '<p>解説文<img alt="imageKey" /></p>',
        },
      ),
      htmlImageState: { realized: true },
    });

    expect(realizeHtmlImagesMock).not.toHaveBeenCalled();
  });

  it('参照画像の寸法が揃わないときは再解決しない', async () => {
    await renderLayout(
      buildState(
        { hasCover: false },
        {
          textHtml: '<p>問題文<img alt="imageKey" /></p>',
          answerTextHtml: '<p>解説文<img alt="imageKey" /></p>',
        },
      ),
      {
        imageKey: {
          url: 'demo-asset://images/firstGrade/imageKey.png?v=md5AAA',
          contentType: 'image/png',
        },
      },
    );

    expect(realizeHtmlImagesMock).not.toHaveBeenCalled();
  });

  it('問題のみでは空の解説ページを生成しない', async () => {
    const { totalPages } = await renderLayout(
      buildState({ hasCover: false, mode: 'onlyQuestion' }),
    );

    expect(totalPages).toBe(1);
    expect(paginateAreaMock).toHaveBeenCalledTimes(1);
    expect(paginateAreaMock.mock.calls[0]?.[0].prefix).toBe('question');
  });
});

describe('選択肢番号のインデント分離', () => {
  beforeEach(() => {
    paginationPlan.questionPages = 1;
    paginationPlan.answerPages = 1;
    paginateAreaMock.mockReset();
    realizeHtmlImagesMock.mockClear();
  });

  it('ql-indent-Nが付いた選択肢先頭pでは番号をchoice-index-mark spanに分離する', async () => {
    await renderLayout(
      buildState(
        { hasCover: false },
        {
          questionChoicesHtml: ['<p class="ql-indent-2">選択肢本文</p>'],
        },
      ),
    );

    const choiceP = document.querySelector(
      '[data-part="question-choice"][data-index="0"] p',
    );

    expect(choiceP).not.toBeNull();
    // ql-indent-Nは選択肢本文側にそのまま残る(本文のインデント自体は維持する)
    expect(choiceP?.classList.contains('ql-indent-2')).toBe(true);

    const mark = choiceP?.firstElementChild;
    expect(mark?.classList.contains('choice-index-mark')).toBe(true);
    expect(mark?.textContent).toBe('1．');
  });
});

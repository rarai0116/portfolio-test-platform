import type { CreatePdfPreviewSnapshot } from '@shared/types/pdfPreview';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLayoutStateFromCreatePdfSnapshot } from './buildLayoutStateFromCreatePdfSnapshot';

const { realizeHtmlImagesMock, sanitizeForPreviewRenderMock } = vi.hoisted(
  () => ({
    realizeHtmlImagesMock: vi.fn((html: string) => `realized:${html}`),
    sanitizeForPreviewRenderMock: vi.fn((html: string) => ({
      sanitizedHtml: `sanitized:${html}`,
    })),
  }),
);

vi.mock('@components/templates/preview/imageRealizer', () => ({
  realizeHtmlImages: realizeHtmlImagesMock,
}));

vi.mock('@renderer/api/htmlSanitizer', () => ({
  sanitizeForPreviewRender: sanitizeForPreviewRenderMock,
}));

const makeSnapshot = (
  overrides: Partial<CreatePdfPreviewSnapshot> = {},
): CreatePdfPreviewSnapshot => ({
  schemaVersion: 1,
  creationType: 'workbook',
  workbookMode: 'multipleChoice',
  grade: 1,
  title: 'テスト',
  layout: {
    pageSize: 'B5',
    hasCover: true,
    hasSubCategoryHeading: true,
  },
  items: [],
  imageRefs: [],
  generatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('buildLayoutStateFromCreatePdfSnapshot', () => {
  afterEach(() => {
    realizeHtmlImagesMock.mockClear();
    sanitizeForPreviewRenderMock.mockClear();
  });

  it('snapshot.workbookMode="qaa" のとき options.workbookMode が "qaa" になる', () => {
    const snapshot = makeSnapshot({ workbookMode: 'qaa' });
    const { options } = buildLayoutStateFromCreatePdfSnapshot(snapshot, {});
    expect(options.workbookMode).toBe('qaa');
  });

  it('snapshot.workbookMode="multipleChoice" のとき options.workbookMode が "multipleChoice" になる', () => {
    const snapshot = makeSnapshot({ workbookMode: 'multipleChoice' });
    const { options } = buildLayoutStateFromCreatePdfSnapshot(snapshot, {});
    expect(options.workbookMode).toBe('multipleChoice');
  });

  it('snapshot.workbookMode=null のとき options.workbookMode が undefined になる', () => {
    const snapshot = makeSnapshot({ workbookMode: null });
    const { options } = buildLayoutStateFromCreatePdfSnapshot(snapshot, {});
    expect(options.workbookMode).toBeUndefined();
  });

  it('snapshot の実施年月日を options に渡す', () => {
    const snapshot = makeSnapshot({
      creationType: 'exam',
      workbookMode: null,
      examDate: { year: '2026', month: '7', day: '1' },
    });
    const { options } = buildLayoutStateFromCreatePdfSnapshot(snapshot, {});

    expect(options.examDate).toEqual({ year: '2026', month: '7', day: '1' });
  });

  it('旧 snapshot で実施年月日が欠落している場合は空文字に補完する', () => {
    const snapshot = makeSnapshot({
      creationType: 'exam',
      workbookMode: null,
    });
    const { options } = buildLayoutStateFromCreatePdfSnapshot(snapshot, {});

    expect(options.examDate).toEqual({ year: '', month: '', day: '' });
  });

  it('snapshot 内 HTML を再サニタイズせず、画像解決だけを行う', () => {
    const images = {
      imageKey: {
        url: 'demo-asset://images/firstGrade/imageKey.png?v=md5AAA',
        contentType: 'image/png',
        width: 2400,
        height: 1985,
      },
    };
    const snapshot = makeSnapshot({
      items: [
        {
          itemId: 'item-1',
          sourceNo: 1,
          sourceKind: 'existing',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類',
          smallCategoryTag: '小分類',
          questionHtml: '<p data-keep="1">問題<img alt="imageKey" /></p>',
          questionChoicesHtml: ['<p>選択肢</p>'],
          answerHtml: '<p>解説</p>',
          answerChoicesHtml: ['<p>選択肢解説</p>'],
          answerNo: '1',
        },
      ],
    });

    const { htmlImageState, items } = buildLayoutStateFromCreatePdfSnapshot(
      snapshot,
      images,
    );

    expect(items[0]).toMatchObject({
      textHtml: 'realized:<p data-keep="1">問題<img alt="imageKey" /></p>',
      questionChoicesHtml: ['realized:<p>選択肢</p>'],
      answerTextHtml: 'realized:<p>解説</p>',
      answerChoicesHtml: ['realized:<p>選択肢解説</p>'],
    });
    expect(realizeHtmlImagesMock).toHaveBeenCalledTimes(4);
    expect(realizeHtmlImagesMock).toHaveBeenCalledWith(
      '<p data-keep="1">問題<img alt="imageKey" /></p>',
      images,
    );
    expect(sanitizeForPreviewRenderMock).not.toHaveBeenCalled();
    expect(htmlImageState).toEqual({ realized: true });
  });

  it('参照画像の寸法が揃わないときは事前の画像解決を行わない', () => {
    const images = {
      imageKey: {
        url: 'demo-asset://images/firstGrade/imageKey.png?v=md5AAA',
        contentType: 'image/png',
      },
    };
    const snapshot = makeSnapshot({
      items: [
        {
          itemId: 'item-1',
          sourceNo: 1,
          sourceKind: 'existing',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類',
          smallCategoryTag: '小分類',
          questionHtml: '<p data-keep="1">問題<img alt="imageKey" /></p>',
          questionChoicesHtml: ['<p>選択肢</p>'],
          answerHtml: '<p>解説</p>',
          answerChoicesHtml: ['<p>選択肢解説</p>'],
          answerNo: '1',
        },
      ],
    });

    const { htmlImageState, items } = buildLayoutStateFromCreatePdfSnapshot(
      snapshot,
      images,
    );

    expect(items[0]).toMatchObject({
      textHtml: '<p data-keep="1">問題<img alt="imageKey" /></p>',
      questionChoicesHtml: ['<p>選択肢</p>'],
      answerTextHtml: '<p>解説</p>',
      answerChoicesHtml: ['<p>選択肢解説</p>'],
    });
    expect(realizeHtmlImagesMock).not.toHaveBeenCalled();
    expect(sanitizeForPreviewRenderMock).not.toHaveBeenCalled();
    expect(htmlImageState).toEqual({ realized: false });
  });
});

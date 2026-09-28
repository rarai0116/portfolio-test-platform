import type { CreatePdfPreviewSnapshot } from '@shared/types/pdfPreview';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildCreatePdfExportManifest } from './createPdfExportManifest';

const createSnapshot = (
  overrides: Partial<CreatePdfPreviewSnapshot> = {},
): CreatePdfPreviewSnapshot => ({
  schemaVersion: 1,
  creationType: 'workbook',
  workbookMode: 'qaa',
  grade: 1,
  title: '確認タイトル',
  layout: {
    pageSize: 'B5',
    hasCover: true,
    hasSubCategoryHeading: false,
  },
  items: [],
  imageRefs: [],
  generatedAt: '2026-05-24T00:00:00.000Z',
  ...overrides,
});

describe('buildCreatePdfExportManifest', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('workbook snapshot から pagesRange なしの単一 unit を返す', () => {
    const result = buildCreatePdfExportManifest({
      slotKey: 'grade:1:workbookMode:qaa',
      revision: 4,
      snapshot: createSnapshot(),
    });

    expect(result).toEqual({
      ok: true,
      manifest: {
        creationType: 'workbook',
        slotKey: 'grade:1:workbookMode:qaa',
        revision: 4,
        title: '確認タイトル',
        units: [
          {
            unitId: 'workbook',
            kind: 'workbook',
            groupId: 'workbook',
            fileName: '問題集_1級_一問一答_確認タイトル.pdf',
          },
        ],
      },
    });
  });

  it('workbook の表紙なしでは title-container の表紙と空白ページを除外する', () => {
    document.body.innerHTML = `
      <article id="page-body">
        <div id="title-container">
          <section class="print-firstpage"></section>
          <section class="print-page blank-page"></section>
        </div>
        <div id="question-container">
          <section class="print-page"></section>
        </div>
        <div id="answer-container">
          <section class="print-page"></section>
        </div>
      </article>
    `;

    const result = buildCreatePdfExportManifest({
      slotKey: 'grade:1:workbookMode:qaa',
      revision: 4,
      snapshot: createSnapshot(),
      root: document,
      options: { includeCover: false },
    });

    expect(result).toMatchObject({
      ok: true,
      manifest: {
        units: [
          {
            unitId: 'workbook',
            pagesRanges: [{ start: 3, end: 4 }],
          },
        ],
      },
    });
  });

  it('exam snapshot から複数 unit と pagesRange を組み立てる', () => {
    document.body.innerHTML = `
      <article id="page-body">
        <div id="question-container">
          <section class="print-firstpage" data-preview-group-id="question-booklet-1" data-preview-group-kind="question"></section>
          <section class="print-page" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-subject="学科Ⅰ"></section>
          <section class="print-page" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-subject="学科Ⅱ"></section>
          <section class="print-firstpage" data-preview-group-id="question-booklet-2" data-preview-group-kind="question"></section>
          <section class="print-page" data-preview-group-id="question-booklet-2" data-preview-group-kind="question" data-preview-subject="学科Ⅲ"></section>
        </div>
        <div id="answer-container">
          <section class="print-firstpage" data-preview-group-id="answer-booklet-学科Ⅰ" data-preview-group-kind="answer" data-preview-subject="学科Ⅰ"></section>
          <section class="print-firstpage" data-preview-group-id="answer-booklet-学科Ⅱ" data-preview-group-kind="answer" data-preview-subject="学科Ⅱ"></section>
        </div>
      </article>
    `;

    const result = buildCreatePdfExportManifest({
      slotKey: 'grade:1',
      revision: 2,
      snapshot: createSnapshot({ creationType: 'exam', workbookMode: null }),
      root: document,
    });

    expect(result).toEqual({
      ok: true,
      manifest: {
        creationType: 'exam',
        slotKey: 'grade:1',
        revision: 2,
        title: '確認タイトル',
        units: [
          {
            unitId: 'question-booklet-1',
            kind: 'exam-question',
            groupId: 'question-booklet-1',
            fileName: '問題用紙_学科Ⅰ・Ⅱ.pdf',
            pagesRange: {
              start: 1,
              end: 3,
            },
          },
          {
            unitId: 'question-booklet-2',
            kind: 'exam-question',
            groupId: 'question-booklet-2',
            fileName: '問題用紙_学科Ⅲ.pdf',
            pagesRange: {
              start: 4,
              end: 5,
            },
          },
          {
            unitId: 'answer-booklet-学科Ⅰ',
            kind: 'exam-answer',
            groupId: 'answer-booklet-学科Ⅰ',
            fileName: '解説用紙_学科Ⅰ（計画）.pdf',
            pagesRange: {
              start: 6,
              end: 6,
            },
          },
          {
            unitId: 'answer-booklet-学科Ⅱ',
            kind: 'exam-answer',
            groupId: 'answer-booklet-学科Ⅱ',
            fileName: '解説用紙_学科Ⅱ（環境・設備）.pdf',
            pagesRange: {
              start: 7,
              end: 7,
            },
          },
        ],
      },
    });
  });

  it('exam の表紙なし・中表紙なしでは cover/blank/middle ページを除外する', () => {
    document.body.innerHTML = `
      <article id="page-body">
        <div id="question-container">
          <section class="print-firstpage" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-cover-role="cover"></section>
          <section class="print-page" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-cover-role="blank"></section>
          <section class="print-page" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-subject="学科Ⅰ"></section>
          <section class="print-firstpage" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-cover-role="middle" data-preview-subject="学科Ⅱ"></section>
          <section class="print-page" data-preview-group-id="question-booklet-1" data-preview-group-kind="question" data-preview-subject="学科Ⅱ"></section>
        </div>
        <div id="answer-container">
          <section class="print-firstpage" data-preview-group-id="answer-booklet-学科Ⅰ" data-preview-group-kind="answer" data-preview-cover-role="cover" data-preview-subject="学科Ⅰ"></section>
          <section class="print-page" data-preview-group-id="answer-booklet-学科Ⅰ" data-preview-group-kind="answer" data-preview-subject="学科Ⅰ"></section>
        </div>
      </article>
    `;

    const result = buildCreatePdfExportManifest({
      slotKey: 'grade:1',
      revision: 2,
      snapshot: createSnapshot({ creationType: 'exam', workbookMode: null }),
      root: document,
      options: { includeCover: false, includeMiddleCover: false },
    });

    expect(result).toMatchObject({
      ok: true,
      manifest: {
        units: [
          {
            unitId: 'question-booklet-1',
            kind: 'exam-question',
            fileName: '問題用紙_学科Ⅰ・Ⅱ.pdf',
            pagesRanges: [
              { start: 3, end: 3 },
              { start: 5, end: 5 },
            ],
          },
          {
            unitId: 'answer-booklet-学科Ⅰ',
            kind: 'exam-answer',
            fileName: '解説用紙_学科Ⅰ（計画）.pdf',
            pagesRanges: [{ start: 7, end: 7 }],
          },
        ],
      },
    });
  });
});

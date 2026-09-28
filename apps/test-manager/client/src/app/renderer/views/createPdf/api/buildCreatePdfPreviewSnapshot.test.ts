import type { TestData } from '@shared/types/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestTableRow } from '../types/testTable';
import { buildCreatePdfPreviewSnapshot } from './buildCreatePdfPreviewSnapshot';

// exportHtmlForPreview は入力をそのまま返すスタブとする
vi.mock('@renderer/api/quillUtils', () => ({
  exportHtmlForPreview: (html: string) => html,
}));

vi.mock('@api/utils', () => ({
  extractImageIdsFromHtml: (html: string | undefined) => {
    if (!html) return [];
    const matches = html.match(/alt="([^"]+)"/g) ?? [];
    return matches.map((match) => match.slice(5, -1));
  },
  toIsoFromTimestampLike: () => '2024-01-01T00:00:00.000Z',
}));

const makeRow = (
  no: number,
  qaaChoiceIndex: number | null = null,
): TestTableRow => ({
  id: `row-${no}`,
  sourceConditionId: 'cond-1',
  categoryTable: [
    {
      id: 'cat-1',
      subject: '学科Ⅰ',
      bigCategoryTag: null,
      smallCategoryTag: null,
    },
  ],
  selectedNo: String(no),
  qaaChoiceIndex,
  isFixed: false,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
});

const makeTestData = (overrides: Partial<TestData> = {}): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '解説本文全体',
  answerText1: '選択肢1解説',
  answerText2: '選択肢2解説',
  answerText3: '選択肢3解説',
  answerText4: '選択肢4解説',
  answerText5: '選択肢5解説',
  bigCategoryTag: '大分類',
  ch1: '選択肢A',
  ch2: '選択肢B',
  ch3: '選択肢C',
  ch4: '選択肢D',
  ch5: '選択肢E',
  difficult: '2',
  grade: 1,
  id: 'test-1',
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  isOriginal: false,
  nengo: '令和',
  no: 1,
  parentNo: 0,
  smallCategoryTag: '小分類',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: '1',
  text: '問題本文',
  themeTag: '',
  year: '2024',
  ...overrides,
});

describe('buildCreatePdfPreviewSnapshot', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── answerBool / calcQaaAnswerBool ──────────────────────────────────

  it('isNegativeAnswer=false かつ qaaChoiceIndex が answerNumber と一致 → answerBool=true', () => {
    const source = makeTestData({ answerNumber: '1', isNegativeAnswer: false });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)], // choiceIndex=1 → choiceNo=1 = answerNumber
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerBool).toBe(true);
  });

  it('isNegativeAnswer=false かつ qaaChoiceIndex が answerNumber と不一致 → answerBool=false', () => {
    const source = makeTestData({ answerNumber: '1', isNegativeAnswer: false });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 2)], // choiceIndex=2 → choiceNo=2 ≠ answerNumber=1
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerBool).toBe(false);
  });

  it('isNegativeAnswer=true かつ qaaChoiceIndex が answerNumber と一致 → answerBool=false', () => {
    const source = makeTestData({ answerNumber: '2', isNegativeAnswer: true });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 2)], // choiceIndex=2 → choiceNo=2 = answerNumber=2
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerBool).toBe(false);
  });

  it('isNegativeAnswer=true かつ qaaChoiceIndex が answerNumber と不一致 → answerBool=true', () => {
    const source = makeTestData({ answerNumber: '2', isNegativeAnswer: true });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)], // choiceIndex=1 → choiceNo=1 ≠ answerNumber=2
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerBool).toBe(true);
  });

  it('qaaAllTrue モードではすべてのアイテムの answerBool が true', () => {
    const testDataByNo = new Map([
      [1, makeTestData({ no: 1, answerNumber: '1', isNegativeAnswer: false })],
      [
        2,
        makeTestData({
          no: 2,
          id: 'test-2',
          answerNumber: '1',
          isNegativeAnswer: false,
        }),
      ],
    ]);
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaaAllTrue',
      tableRows: [makeRow(1, 2), makeRow(2, 2)], // choiceNo=2 ≠ answerNumber=1 → 通常はfalseだがqaaAllTrueで強制true
      testDataByNo,
      imageItems: [],
    });
    expect(snapshot.items.every((item) => item.answerBool === true)).toBe(true);
  });

  it('qaaAllFalse モードではすべてのアイテムの answerBool が false', () => {
    const testDataByNo = new Map([
      [1, makeTestData({ no: 1, answerNumber: '1', isNegativeAnswer: false })],
      [
        2,
        makeTestData({
          no: 2,
          id: 'test-2',
          answerNumber: '1',
          isNegativeAnswer: false,
        }),
      ],
    ]);
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaaAllFalse',
      tableRows: [makeRow(1, 1), makeRow(2, 1)], // choiceNo=1 = answerNumber=1 → 通常はtrueだがqaaAllFalseで強制false
      testDataByNo,
      imageItems: [],
    });
    expect(snapshot.items.every((item) => item.answerBool === false)).toBe(
      true,
    );
  });

  // ── answerHtml（選択肢別解説）───────────────────────────────────────

  it('qaa モードで qaaChoiceIndex=1 のとき answerHtml に answerText1 が設定される', () => {
    const source = makeTestData({ answerText1: '選択肢1の解説テキスト' });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerHtml).toBe('選択肢1の解説テキスト');
  });

  it('qaa モードで qaaChoiceIndex=3 のとき answerHtml に answerText3 が設定される', () => {
    const source = makeTestData({ answerText3: '選択肢3の解説テキスト' });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 3)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerHtml).toBe('選択肢3の解説テキスト');
  });

  it('answerText[n] が空文字のとき console.warn が呼ばれる', () => {
    const source = makeTestData({ answerText1: '' });
    buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[buildCreatePdfPreviewSnapshot]'),
    );
  });

  it('answerText[n] が空文字のとき warnings 配列に該当アイテム情報が含まれる', () => {
    const source = makeTestData({ answerText1: '' });
    const { warnings } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ sourceNo: 1 });
  });

  it('answerText[n] が空文字のとき answerHtml は空のまま（フォールバックなし）', () => {
    const source = makeTestData({ answerText1: '' });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerHtml).toBe('');
  });

  it('multipleChoice モードで answerHtml に answerText（本文全体）が使われる', () => {
    const source = makeTestData({ answerText: '解説本文全体のテキスト' });
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'multipleChoice',
      tableRows: [makeRow(1, null)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });
    expect(snapshot.items[0]?.answerHtml).toBe('解説本文全体のテキスト');
  });

  it('multipleChoice モードの一級では4択を設定する', () => {
    const source = makeTestData();
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'multipleChoice',
      tableRows: [makeRow(1, null)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });

    expect(snapshot.items[0]?.questionChoicesHtml).toEqual([
      '選択肢A',
      '選択肢B',
      '選択肢C',
      '選択肢D',
    ]);
    expect(snapshot.items[0]?.answerChoicesHtml).toEqual([
      '選択肢1解説',
      '選択肢2解説',
      '選択肢3解説',
      '選択肢4解説',
    ]);
  });

  it('multipleChoice モードの二級では5択を設定する', () => {
    const source = makeTestData();
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 2,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'multipleChoice',
      tableRows: [makeRow(1, null)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [],
    });

    expect(snapshot.items[0]?.questionChoicesHtml).toEqual([
      '選択肢A',
      '選択肢B',
      '選択肢C',
      '選択肢D',
      '選択肢E',
    ]);
    expect(snapshot.items[0]?.answerChoicesHtml).toEqual([
      '選択肢1解説',
      '選択肢2解説',
      '選択肢3解説',
      '選択肢4解説',
      '選択肢5解説',
    ]);
  });

  // ── workbookMode のスナップショットへの記録 ────────────────────────

  it('qaa モードで生成されたスナップショットの workbookMode が "qaa"', () => {
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [],
      testDataByNo: new Map(),
      imageItems: [],
    });
    expect(snapshot.workbookMode).toBe('qaa');
  });

  it('multipleChoice モードで生成されたスナップショットの workbookMode が "multipleChoice"', () => {
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'multipleChoice',
      tableRows: [],
      testDataByNo: new Map(),
      imageItems: [],
    });
    expect(snapshot.workbookMode).toBe('multipleChoice');
  });

  it('exam スコープで生成されたスナップショットの workbookMode が null', () => {
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'exam',
      tableSections: [],
      testDataByNo: new Map(),
      imageItems: [],
    });
    expect(snapshot.workbookMode).toBeNull();
  });

  it('exam スコープでは実施年月日を snapshot に保存する', () => {
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'exam',
      tableSections: [],
      testDataByNo: new Map(),
      imageItems: [],
      examDate: { year: '2026', month: '', day: '1' },
    });

    expect(snapshot.examDate).toEqual({ year: '2026', month: '', day: '1' });
  });

  it('workbook スコープでは実施年月日を snapshot に保存しない', () => {
    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'multipleChoice',
      tableRows: [],
      testDataByNo: new Map(),
      imageItems: [],
      examDate: { year: '2026', month: '7', day: '1' },
    });

    expect(snapshot.examDate).toBeUndefined();
  });

  it('参照されている画像だけを imageRefs に含める', () => {
    const source = makeTestData({
      ch1: '<p><img alt="used-image" /></p>',
      answerText1: '<p><img alt="answer-image" /></p>',
    });

    const { snapshot } = buildCreatePdfPreviewSnapshot({
      grade: 1,
      title: 'テスト',
      creationType: 'workbook',
      workbookMode: 'qaa',
      tableRows: [makeRow(1, 1)],
      testDataByNo: new Map([[1, source]]),
      imageItems: [
        {
          grade: 'firstGrade',
          key: 'used-image',
          objectPath: 'images/used-image.png',
          name: 'used-image.png',
          updatedAt: undefined,
          width: 120,
          height: 80,
        },
        {
          grade: 'firstGrade',
          key: 'answer-image',
          objectPath: 'images/answer-image.png',
          name: 'answer-image.png',
          updatedAt: undefined,
          width: 90,
          height: 60,
        },
        {
          grade: 'firstGrade',
          key: 'unused-image',
          objectPath: 'images/unused-image.png',
          name: 'unused-image.png',
          updatedAt: undefined,
          width: 50,
          height: 40,
        },
      ],
    });

    expect(snapshot.imageRefs).toEqual([
      {
        grade: 'firstGrade',
        key: 'used-image',
        objectPath: 'images/used-image.png',
        updatedAt: '2024-01-01T00:00:00.000Z',
        width: 120,
        height: 80,
      },
      {
        grade: 'firstGrade',
        key: 'answer-image',
        objectPath: 'images/answer-image.png',
        updatedAt: '2024-01-01T00:00:00.000Z',
        width: 90,
        height: 60,
      },
    ]);
  });
});

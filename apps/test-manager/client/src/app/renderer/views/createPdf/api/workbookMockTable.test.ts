import type { TestData } from '@shared/types/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkbookMockRows,
  getNextWorkbookMockSubject,
} from './workbookMockTable';

const createTestData = (
  no: number,
  subject: TestData['subject'],
  choices: Partial<Record<'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5', string>> = {},
  overrides: Partial<Pick<TestData, 'isConvertibleQaa'>> = {},
): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '大分類A',
  ch1: choices.ch1 ?? '選択肢1',
  ch2: choices.ch2 ?? '選択肢2',
  ch3: choices.ch3 ?? '選択肢3',
  ch4: choices.ch4 ?? '選択肢4',
  ch5: choices.ch5 ?? '選択肢5',
  difficult: '1',
  grade: subject === '学科Ⅴ' ? 1 : 1,
  id: `id-${no}`,
  isConvertibleQaa: overrides.isConvertibleQaa ?? false,
  isNegativeAnswer: false,
  nengo: '',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject,
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
});

describe('workbookMockTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('未使用の次の学科を返す', () => {
    expect(
      getNextWorkbookMockSubject(1, [
        {
          id: 'condition-1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 1,
        },
      ]),
    ).toBe('学科Ⅱ');
  });

  it('subject ごとに重複なしで rows と shortage を生成する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ')],
      [2, createTestData(2, '学科Ⅰ')],
      [3, createTestData(3, '学科Ⅱ')],
    ]);

    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'multipleChoice',
      conditions: [
        {
          id: 'condition-1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 3,
        },
        {
          id: 'condition-2',
          subject: '学科Ⅱ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 1,
        },
      ],
      testDataByNo,
    });

    expect(result.rows).toHaveLength(3);
    expect(new Set(result.rows.map((row) => row.selectedNo)).size).toBe(3);
    expect(result.summaries).toEqual([
      {
        conditionId: 'condition-1',
        subject: '学科Ⅰ',
        requestedCount: 3,
        actualCount: 2,
        shortageCount: 1,
      },
      {
        conditionId: 'condition-2',
        subject: '学科Ⅱ',
        requestedCount: 1,
        actualCount: 1,
        shortageCount: 0,
      },
    ]);
  });

  it('qaa 系では grade ごとのレンジで qaaChoiceIndex を採る', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'qaa',
      conditions: [
        {
          id: 'condition-1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 1,
        },
      ],
      testDataByNo: new Map([
        [
          1,
          // qaa モードでは isConvertibleQaa=true が必要
          createTestData(
            1,
            '学科Ⅰ',
            { ch1: '', ch2: '選択肢2', ch3: '', ch4: '', ch5: '選択肢5' },
            { isConvertibleQaa: true },
          ),
        ],
      ]),
    });

    expect(result.rows[0]?.qaaChoiceIndex).toBe(2);
  });

  it('isConvertibleQaa=false の問題が qaa モードで候補から除外される', () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', {}, { isConvertibleQaa: false })],
      [2, createTestData(2, '学科Ⅰ', {}, { isConvertibleQaa: true })],
    ]);
    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'qaa',
      conditions: [
        {
          id: 'c1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 2,
        },
      ],
      testDataByNo,
    });
    // isConvertibleQaa=true の no=2 のみ候補になる
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.selectedNo).toBe('2');
  });

  it('isConvertibleQaa=false の問題が qaaAllTrue モードで候補から除外される', () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', {}, { isConvertibleQaa: false })],
      [2, createTestData(2, '学科Ⅰ', {}, { isConvertibleQaa: true })],
    ]);
    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'qaaAllTrue',
      conditions: [
        {
          id: 'c1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 2,
        },
      ],
      testDataByNo,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.selectedNo).toBe('2');
  });

  it('isConvertibleQaa=false の問題が qaaAllFalse モードで候補から除外される', () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', {}, { isConvertibleQaa: false })],
      [2, createTestData(2, '学科Ⅰ', {}, { isConvertibleQaa: true })],
    ]);
    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'qaaAllFalse',
      conditions: [
        {
          id: 'c1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 2,
        },
      ],
      testDataByNo,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.selectedNo).toBe('2');
  });

  it('isConvertibleQaa=false の問題が multipleChoice モードでは除外されない', () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', {}, { isConvertibleQaa: false })],
      [2, createTestData(2, '学科Ⅰ', {}, { isConvertibleQaa: true })],
    ]);
    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'multipleChoice',
      conditions: [
        {
          id: 'c1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 2,
        },
      ],
      testDataByNo,
    });
    // multipleChoice では isConvertibleQaa に関わらず両方が候補になる
    expect(result.rows).toHaveLength(2);
  });

  it('isConvertibleQaa=true の問題のみの場合、qaa モードで正常に抽選される', () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', {}, { isConvertibleQaa: true })],
      [2, createTestData(2, '学科Ⅰ', {}, { isConvertibleQaa: true })],
    ]);
    const result = buildWorkbookMockRows({
      grade: 1,
      workbookMode: 'qaa',
      conditions: [
        {
          id: 'c1',
          subject: '学科Ⅰ',
          bigCategoryTag: null,
          smallCategoryTag: null,
          count: 2,
        },
      ],
      testDataByNo,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.summaries[0]?.shortageCount).toBe(0);
  });
});

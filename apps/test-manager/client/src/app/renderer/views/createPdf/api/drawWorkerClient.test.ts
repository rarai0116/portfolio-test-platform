import type { TestData } from '@shared/types/contracts';
import { buildCandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import { describe, expect, it } from 'vitest';
import { shouldRunDrawInWorker } from './drawWorkerClient';

const baseTestData = (
  no: number,
  overrides: Partial<TestData> = {},
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
  ch1: '選択肢1',
  ch2: '選択肢2',
  ch3: '選択肢3',
  ch4: '選択肢4',
  ch5: '',
  difficult: '1',
  grade: 1,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: '令和',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '6',
  ...overrides,
});

const defaultOptions = {
  excludedTagIds: [],
  excludePastExam: false,
  excludeOriginal: false,
  isShuffleChoices: false,
  shuffleSeed: null,
};

const createSlot = (id: string): DrawSlot => ({
  id,
  sourceConditionId: 'condition-1',
  subject: '学科Ⅰ',
  conditions: [{ big: '大分類A', small: '小分類A-1' }],
  fixedNo: null,
  fixedChoiceIndex: null,
});

describe('shouldRunDrawInWorker', () => {
  it('BFS 見積もりコストが閾値未満なら false を返す', () => {
    const index = buildCandidateIndex({
      testDataByNo: new Map([[1, baseTestData(1)]]),
      options: defaultOptions,
    });

    expect(shouldRunDrawInWorker({ slots: [createSlot('slot-1')], index })).toBe(
      false,
    );
  });

  it('BFS 見積もりコストが閾値以上なら true を返す', () => {
    const rows = Array.from({ length: 150 }, (_, i) => {
      const difficulty = String((i % 3) + 1);
      return baseTestData(i + 1, { difficult: difficulty });
    });
    const index = buildCandidateIndex({
      testDataByNo: new Map(rows.map((row) => [row.no, row])),
      options: defaultOptions,
    });
    const slots = Array.from({ length: 5 }, (_, i) =>
      createSlot(`slot-${i + 1}`),
    );

    expect(shouldRunDrawInWorker({ slots, index })).toBe(true);
  });
});

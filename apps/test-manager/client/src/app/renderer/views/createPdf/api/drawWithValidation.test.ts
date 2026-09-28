import type { TestData } from '@shared/types/contracts';
import { buildCandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAW_WITH_VALIDATION_FAILURE_MESSAGE,
  runDrawWithValidation,
} from './drawWithValidation';

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

const slot: DrawSlot = {
  id: 'slot-1',
  sourceConditionId: 'condition-1',
  subject: '学科Ⅰ',
  conditions: [{ big: '大分類A', small: '小分類A-1' }],
  fixedNo: null,
  fixedChoiceIndex: null,
};

describe('runDrawWithValidation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('抽選後検証に成功した場合は1回目の結果を返す', () => {
    const testDataByNo = new Map([[1, baseTestData(1)]]);
    const index = buildCandidateIndex({
      testDataByNo,
      options: defaultOptions,
    });

    const result = runDrawWithValidation({
      slots: [slot],
      index,
      difficulty: {
        isCalculated: true,
        ratios: [100, 0],
        entityCount: [1, 0, 0],
        settableDifficultyRanges: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('structured clone された CandidateIndex でも抽選できる', () => {
    const testDataByNo = new Map([
      [1, baseTestData(1, { difficult: '1' })],
      [2, baseTestData(2, { difficult: '2' })],
    ]);
    const index = buildCandidateIndex({
      testDataByNo,
      options: defaultOptions,
    });

    const clonedIndex = structuredClone(index);

    expect(clonedIndex.bySmallCategory).toBeInstanceOf(Map);
    expect(clonedIndex.allByNo).toBeInstanceOf(Map);

    const result = runDrawWithValidation({
      slots: [slot],
      index: clonedIndex,
      difficulty: {
        isCalculated: true,
        ratios: [100, 100],
        entityCount: [1, 0, 0],
        settableDifficultyRanges: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it('抽選後検証に失敗し続けた場合は指定回数で打ち切る', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixedUnknownSlot: DrawSlot = {
      ...slot,
      fixedNo: '99',
      fixedChoiceIndex: 1,
    };
    const testDataByNo = new Map([[1, baseTestData(1)]]);
    const index = buildCandidateIndex({
      testDataByNo,
      options: defaultOptions,
    });

    const result = runDrawWithValidation({
      slots: [fixedUnknownSlot],
      index,
      difficulty: {
        isCalculated: true,
        ratios: [100, 100],
        entityCount: [1, 0, 0],
        settableDifficultyRanges: null,
      },
      maxAttempts: 3,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('抽選後検証は失敗する想定です。');
    expect(result.attempts).toBe(3);
    expect(result.userMessage).toBe(DRAW_WITH_VALIDATION_FAILURE_MESSAGE);
    expect(result.validationErrors).toHaveLength(1);
  });

  it('抽選エンジンエラーは再試行せず即時終了する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const index = buildCandidateIndex({
      testDataByNo: new Map(),
      options: defaultOptions,
    });

    const result = runDrawWithValidation({
      slots: [slot],
      index,
      difficulty: {
        isCalculated: true,
        ratios: [100, 0],
        entityCount: [1, 0, 0],
        settableDifficultyRanges: null,
      },
      maxAttempts: 5,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('抽選エンジンエラー想定です。');
    expect(result.attempts).toBe(1);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.drawError?.hasError).toBe(true);
  });
});

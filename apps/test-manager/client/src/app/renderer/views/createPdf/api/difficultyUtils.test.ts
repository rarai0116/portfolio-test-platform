import type { TestData } from '@shared/types/contracts';
import { buildCandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type { DifficultyRange } from '@views/createPdf/types/draftState';
import { describe, expect, it } from 'vitest';
import {
  adjustDifficultyByFeasibility,
  buildDifficultyFeasibility,
  calcDifficultySliderDynamicBounds,
  calcNaturalRatios,
  calcSettableDifficultyRanges,
  clampRatiosToRanges,
  createDifficultyCountKey,
  findNearestAssignablePattern,
} from './difficultyUtils';

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
  bigCategoryTag: 'カテゴリA',
  ch1: '選択肢1',
  ch2: '選択肢2',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 1,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: '令和',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '6',
  ...overrides,
});

const createSlot = (params: {
  id: string;
  big: string;
  fixedNo?: string | null;
}): DrawSlot => ({
  id: params.id,
  sourceConditionId: params.id,
  subject: '学科Ⅰ',
  conditions: [{ big: params.big, small: '小分類' }],
  fixedNo: params.fixedNo ?? null,
  fixedChoiceIndex: null,
});

const buildIndex = (testData: readonly TestData[]) =>
  buildCandidateIndex({
    testDataByNo: new Map(testData.map((data) => [data.no, data])),
    options: {
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isShuffleChoices: false,
      shuffleSeed: null,
    },
  });

// ─── calcNaturalRatios ──────────────────────────────────────────

describe('calcNaturalRatios', () => {
  it('問題プールの比率に合わせた自然な割合を返す', () => {
    // ⭐30, ⭐⭐30, ⭐⭐⭐40 → [30, 60]
    const result = calcNaturalRatios([30, 30, 40]);
    expect(result).toEqual([30, 60]);
  });

  it('合計が0のときデフォルト値[30,70]を返す', () => {
    expect(calcNaturalRatios([0, 0, 0])).toEqual([30, 70]);
  });

  it('⭐⭐⭐のみの場合: thumb1=0, thumb2=0', () => {
    // ⭐0, ⭐⭐0, ⭐⭐⭐100
    const result = calcNaturalRatios([0, 0, 100]);
    expect(result).toEqual([0, 0]);
  });

  it('⭐のみの場合: thumb1=100, thumb2=100', () => {
    const result = calcNaturalRatios([100, 0, 0]);
    expect(result).toEqual([100, 100]);
  });
});

// ─── clampRatiosToRanges ────────────────────────────────────────

describe('clampRatiosToRanges', () => {
  /** 制約なし（min=0）の ranges */
  const noConstraint: [DifficultyRange, DifficultyRange, DifficultyRange] = [
    { min: 0, max: 100 },
    { min: 0, max: 100 },
    { min: 0, max: 100 },
  ];

  it('制約を満たしている場合はそのまま返す', () => {
    expect(clampRatiosToRanges([33, 66], noConstraint)).toEqual([33, 66]);
  });

  it('⭐⭐⭐50%固定: naturalRatios=[33,66]のthumb2が50にクランプされる', () => {
    // ⭐⭐⭐min=50 → thumb2の上限 = 100-50 = 50
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      { min: 0, max: 100 },
      { min: 0, max: 100 },
      { min: 50, max: 100 },
    ];
    const [r1, r2] = clampRatiosToRanges([33, 66], ranges);
    expect(r2).toBe(50);
    // thumb1 ≤ thumb2 を保証
    expect(r1).toBeLessThanOrEqual(r2);
    // ⭐⭐⭐ = 100 - thumb2 ≥ 50 を確認
    expect(100 - r2).toBeGreaterThanOrEqual(50);
  });

  it('⭐50%固定: naturalRatios=[10,40]のthumb1が50にクランプされる', () => {
    // ⭐min=50 → thumb1の下限 = 50
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      { min: 50, max: 100 },
      { min: 0, max: 50 },
      { min: 0, max: 50 },
    ];
    const [r1, r2] = clampRatiosToRanges([10, 40], ranges);
    expect(r1).toBeGreaterThanOrEqual(50);
    // thumb1 ≤ thumb2 を保証
    expect(r1).toBeLessThanOrEqual(r2);
  });

  it('⭐⭐min制約: thumb2 ≥ thumb1 + ranges[1].min を保証する', () => {
    // ⭐⭐min=30 → thumb2 ≥ thumb1 + 30
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      { min: 0, max: 100 },
      { min: 30, max: 100 },
      { min: 0, max: 100 },
    ];
    const [r1, r2] = clampRatiosToRanges([50, 55], ranges);
    expect(r2 - r1).toBeGreaterThanOrEqual(30);
    expect(r2).toBeLessThanOrEqual(100);
  });

  it('返り値は常に thumb1 ≤ thumb2 かつ 0 ≤ thumb2 ≤ 100', () => {
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      { min: 20, max: 80 },
      { min: 10, max: 70 },
      { min: 30, max: 70 },
    ];
    const [r1, r2] = clampRatiosToRanges([50, 50], ranges);
    expect(r1).toBeLessThanOrEqual(r2);
    expect(r2).toBeGreaterThanOrEqual(0);
    expect(r2).toBeLessThanOrEqual(100);
  });

  it('⭐⭐⭐min と高い thumb1 が競合しても ⭐⭐⭐ 下限を優先して補正する', () => {
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      { min: 0, max: 100 },
      { min: 0, max: 100 },
      { min: 50, max: 100 },
    ];
    const [r1, r2] = clampRatiosToRanges([60, 60], ranges);
    expect(r1).toBeLessThanOrEqual(r2);
    expect(100 - r2).toBeGreaterThanOrEqual(50);
  });
});

describe('buildDifficultyFeasibility', () => {
  it('固定後に残るカテゴリ枠で選べない難易度は max 0% にする', () => {
    const feasibility = buildDifficultyFeasibility({
      candidateIndex: buildIndex([
        baseTestData(1, { bigCategoryTag: 'カテゴリA', difficult: '3' }),
        baseTestData(2, { bigCategoryTag: 'カテゴリB', difficult: '3' }),
        baseTestData(3, { bigCategoryTag: 'カテゴリC', difficult: '1' }),
        baseTestData(4, { bigCategoryTag: 'カテゴリC', difficult: '3' }),
      ]),
      slots: [
        createSlot({ id: 'slot-a', big: 'カテゴリA', fixedNo: '1' }),
        createSlot({ id: 'slot-b', big: 'カテゴリB', fixedNo: '2' }),
        createSlot({ id: 'slot-c', big: 'カテゴリC' }),
      ],
    });

    expect(feasibility.ranges[0]).toEqual({ min: 0, max: 33 });
    expect(feasibility.ranges[1]).toEqual({ min: 0, max: 0 });
    expect(feasibility.ranges[2]).toEqual({ min: 67, max: 100 });
  });

  it('指定比率に選べない難易度が含まれる場合は近い feasible pattern に補正する', () => {
    const feasibility = buildDifficultyFeasibility({
      candidateIndex: buildIndex([
        baseTestData(1, { bigCategoryTag: 'カテゴリA', difficult: '3' }),
        baseTestData(2, { bigCategoryTag: 'カテゴリB', difficult: '3' }),
        baseTestData(3, { bigCategoryTag: 'カテゴリC', difficult: '1' }),
        baseTestData(4, { bigCategoryTag: 'カテゴリC', difficult: '3' }),
      ]),
      slots: [
        createSlot({ id: 'slot-a', big: 'カテゴリA', fixedNo: '1' }),
        createSlot({ id: 'slot-b', big: 'カテゴリB', fixedNo: '2' }),
        createSlot({ id: 'slot-c', big: 'カテゴリC' }),
      ],
    });

    const result = adjustDifficultyByFeasibility({
      ratios: [0, 33],
      feasibility,
    });

    expect(result.entityCount[1]).toBe(0);
    expect(result.settableDifficultyRanges[1]).toEqual({ min: 0, max: 0 });
  });

  it('BFS上は可能でも候補共有で割当不能な pattern は ranges から除外する', () => {
    const feasibility = buildDifficultyFeasibility({
      candidateIndex: buildIndex([
        baseTestData(1, { bigCategoryTag: 'カテゴリA', difficult: '3' }),
        baseTestData(2, { bigCategoryTag: 'カテゴリA', difficult: '1' }),
        baseTestData(3, { bigCategoryTag: 'カテゴリB', difficult: '3' }),
        baseTestData(4, { bigCategoryTag: 'カテゴリB', difficult: '3' }),
      ]),
      slots: [
        createSlot({ id: 'slot-a-1', big: 'カテゴリA' }),
        createSlot({ id: 'slot-a-2', big: 'カテゴリA' }),
        createSlot({ id: 'slot-b', big: 'カテゴリB' }),
      ],
    });

    expect(feasibility.rawPatternCount).toBeGreaterThan(
      feasibility.patterns.length,
    );
    expect(
      feasibility.assignableCountKeys.has(createDifficultyCountKey([0, 0, 3])),
    ).toBe(false);
    expect(feasibility.ranges[2]).toEqual({ min: 67, max: 67 });
  });
});

describe('calcDifficultySliderDynamicBounds', () => {
  it('thumb2固定時のthumb1範囲と、thumb1固定時のthumb2範囲をassignable patternsから返す', () => {
    const result = calcDifficultySliderDynamicBounds(
      [
        { counts: [4, 4, 2], ratios: [40, 80] },
        { counts: [5, 3, 2], ratios: [50, 80] },
        { counts: [5, 2, 3], ratios: [50, 70] },
        { counts: [6, 2, 2], ratios: [60, 80] },
      ],
      [50, 80],
    );

    expect(result.thumb1).toEqual({ min: 40, max: 60 });
    expect(result.thumb2).toEqual({ min: 70, max: 80 });
  });

  it('現在の固定thumbと両立するpatternがない場合はnullを返す', () => {
    const result = calcDifficultySliderDynamicBounds(
      [{ counts: [4, 4, 2], ratios: [40, 80] }],
      [50, 70],
    );

    expect(result.thumb1).toBeNull();
    expect(result.thumb2).toBeNull();
  });
});

describe('findNearestAssignablePattern', () => {
  it('理論countが割当不能でも、距離2以内の近傍patternを返す', () => {
    const result = findNearestAssignablePattern({
      totalCount: 312,
      ratios: [50, 81],
      patterns: [
        { counts: [154, 99, 59], ratios: [49, 81] },
        { counts: [155, 98, 59], ratios: [50, 81] },
        { counts: [150, 103, 59], ratios: [48, 81] },
      ],
    });

    expect(result?.counts).toEqual([155, 98, 59]);
    expect(result?.ratios).toEqual([50, 81]);
  });

  it('最短count距離がmaxCountDistanceを超える場合はnullを返す', () => {
    const result = findNearestAssignablePattern({
      totalCount: 312,
      ratios: [50, 81],
      patterns: [{ counts: [153, 100, 59], ratios: [49, 81] }],
    });

    expect(result).toBeNull();
  });

  it('count距離が同じ場合はratio距離が近いpatternを選ぶ', () => {
    const result = findNearestAssignablePattern({
      totalCount: 100,
      ratios: [50, 80],
      patterns: [
        { counts: [49, 31, 20], ratios: [49, 80] },
        { counts: [51, 29, 20], ratios: [51, 81] },
      ],
    });

    expect(result?.counts).toEqual([49, 31, 20]);
  });
});

// ─── calcNaturalRatios + clampRatiosToRanges 連携 ────────────────

describe('calculateDifficulty の初期値シナリオ', () => {
  it('⭐⭐⭐50%固定の場合: 自然割合をクランプした初期 ratios が制約を満たす', () => {
    // totalCount=10, プール分布が均等（⭐⭐⭐40%が自然割合）
    const naturalRatios = calcNaturalRatios([30, 30, 40]);
    // calcSettableDifficultyRanges で rawRanges を求め、固定行の下限を追加
    const rawRanges = calcSettableDifficultyRanges(10, [30, 30, 40]);
    const ranges: [DifficultyRange, DifficultyRange, DifficultyRange] = [
      rawRanges[0],
      rawRanges[1],
      // ⭐⭐⭐を5問固定 → min=50%
      { min: Math.max(rawRanges[2].min, 50), max: rawRanges[2].max },
    ];
    const [r1, r2] = clampRatiosToRanges(naturalRatios, ranges);
    // ⭐⭐⭐ = 100 - thumb2 ≥ 50
    expect(100 - r2).toBeGreaterThanOrEqual(50);
    // thumb1 ≤ thumb2
    expect(r1).toBeLessThanOrEqual(r2);
  });

  it('固定行がない場合: naturalRatios がそのまま初期値になる', () => {
    const naturalRatios = calcNaturalRatios([30, 30, 40]);
    const rawRanges = calcSettableDifficultyRanges(10, [30, 30, 40]);
    // 固定行なし → rawRanges をそのまま使用
    const result = clampRatiosToRanges(naturalRatios, rawRanges);
    expect(result).toEqual(naturalRatios);
  });
});

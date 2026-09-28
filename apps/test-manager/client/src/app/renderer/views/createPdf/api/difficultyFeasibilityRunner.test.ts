import type { TestData } from '@shared/types/contracts';
import { buildCandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDifficultyFeasibility,
  type BfsWorkerOutput,
  prepareBfsFeasibility,
} from './difficultyUtils';
import {
  createFixedDrawSlotsSignature,
  createDifficultyFeasibilityTask,
  shouldRunDifficultyFeasibilityInWorker,
} from './difficultyFeasibilityRunner';

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

const emptyWorkerOutput: BfsWorkerOutput = {
  patterns: [],
  ranges: [
    { min: 0, max: 0 },
    { min: 0, max: 0 },
    { min: 0, max: 0 },
  ],
  assignableCountKeys: [],
  rawPatternCount: 0,
  exactFilteringDurationMs: 0,
};

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<BfsWorkerOutput>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postedMessage: unknown = null;
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.postedMessage = message;
  }

  terminate() {
    this.terminated = true;
  }
}

describe('difficultyFeasibilityRunner', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it('閾値未満では同期パスで buildDifficultyFeasibility と同じ結果を返す', async () => {
    const rows = [
      baseTestData(1, { difficult: '1' }),
      baseTestData(2, { difficult: '2' }),
    ];
    const index = buildCandidateIndex({
      testDataByNo: new Map(rows.map((row) => [row.no, row])),
      options: defaultOptions,
    });
    const slots = [createSlot('slot-1')];
    const phase1 = prepareBfsFeasibility({ slots, candidateIndex: index });

    expect(shouldRunDifficultyFeasibilityInWorker(phase1)).toBe(false);

    const result = await createDifficultyFeasibilityTask(phase1).promise;
    const expected = buildDifficultyFeasibility({
      slots,
      candidateIndex: index,
    });

    expect(result.usedWorker).toBe(false);
    expect(result.feasibility.patterns).toEqual(expected.patterns);
    expect(result.feasibility.ranges).toEqual(expected.ranges);
  });

  it('閾値以上では Worker に BFS 入力を渡す', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const rows = Array.from({ length: 150 }, (_, i) =>
      baseTestData(i + 1, { difficult: String((i % 3) + 1) }),
    );
    const index = buildCandidateIndex({
      testDataByNo: new Map(rows.map((row) => [row.no, row])),
      options: defaultOptions,
    });
    const slots = Array.from({ length: 5 }, (_, i) =>
      createSlot(`slot-${i + 1}`),
    );
    const phase1 = prepareBfsFeasibility({ slots, candidateIndex: index });

    expect(shouldRunDifficultyFeasibilityInWorker(phase1)).toBe(true);

    const task = createDifficultyFeasibilityTask(phase1);
    const worker = FakeWorker.instances[0];
    expect(task.usedWorker).toBe(true);
    expect(worker?.postedMessage).toMatchObject({
      remainingCaps: phase1.remainingCaps,
      fixedCounts: phase1.fixedCounts,
      totalCount: phase1.totalCount,
      slotCandidateKeys: expect.any(Array),
      candidateDifficultyByKey: expect.any(Array),
    });

    worker?.onmessage?.({
      data: emptyWorkerOutput,
    } as MessageEvent<BfsWorkerOutput>);

    const result = await task.promise;
    expect(result.usedWorker).toBe(true);
    expect(result.feasibility.totalCount).toBe(phase1.totalCount);
    expect(worker?.terminated).toBe(true);
  });

  it('Worker task は terminate で中断できる', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const rows = Array.from({ length: 150 }, (_, i) =>
      baseTestData(i + 1, { difficult: String((i % 3) + 1) }),
    );
    const index = buildCandidateIndex({
      testDataByNo: new Map(rows.map((row) => [row.no, row])),
      options: defaultOptions,
    });
    const slots = Array.from({ length: 5 }, (_, i) =>
      createSlot(`slot-${i + 1}`),
    );
    const phase1 = prepareBfsFeasibility({ slots, candidateIndex: index });

    const task = createDifficultyFeasibilityTask(phase1);
    const worker = FakeWorker.instances[0];
    task.terminate();

    await expect(task.promise).rejects.toThrow('terminated');
    expect(worker?.terminated).toBe(true);
  });
});

describe('createFixedDrawSlotsSignature', () => {
  it('表示用 row id の差分は無視し、固定状態の差分は検出する', () => {
    const baseSlot = {
      ...createSlot('slot-1'),
      fixedNo: '1',
      fixedChoiceIndex: 0,
    };
    const sameFixedState = {
      ...baseSlot,
      id: 'slot-1-rendered-again',
    };
    const changedFixedState = {
      ...baseSlot,
      fixedNo: '2',
    };

    expect(createFixedDrawSlotsSignature([sameFixedState])).toBe(
      createFixedDrawSlotsSignature([baseSlot]),
    );
    expect(createFixedDrawSlotsSignature([changedFixedState])).not.toBe(
      createFixedDrawSlotsSignature([baseSlot]),
    );
  });
});

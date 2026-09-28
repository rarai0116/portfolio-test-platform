import type { TestData } from '@shared/types/contracts';
import {
  type CandidateIndex,
  resolveCandidates,
  toCandidateKey,
} from '@views/createPdf/api/candidateIndex';
import {
  canAssignDifficultyCounts,
  canAssignPreparedDifficultyCounts,
  type PreparedDifficultyAssignmentInput,
  prepareDifficultyAssignmentInput,
  toDifficultyIndex,
} from '@views/createPdf/api/difficultyAssignment';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type { DifficultyRange } from '@views/createPdf/types/draftState';

/** 難易度別問題数 [★, ★★, ★★★] */
export type AvailableDifficultyTestCounts = [number, number, number];

export type FeasibleDifficultyPattern = {
  counts: AvailableDifficultyTestCounts;
  ratios: [number, number];
};

export type DifficultySliderDynamicBounds = {
  thumb1: DifficultyRange | null;
  thumb2: DifficultyRange | null;
};

export type DifficultyFeasibility = {
  totalCount: number;
  fixedCounts: AvailableDifficultyTestCounts;
  patterns: FeasibleDifficultyPattern[];
  ranges: [DifficultyRange, DifficultyRange, DifficultyRange];
  assignableCountKeys: Set<string>;
  rawPatternCount: number;
  exactFilteringDurationMs: number;
  isPatternAssignable: (counts: AvailableDifficultyTestCounts) => boolean;
};

/**
 * prepareBfsFeasibility の出力型。
 * フェーズ1（前段階）で収集したデータを保持する。
 * candidateIndex はメインスレッド保持のため Worker には渡さない。
 */
export type BfsFeasibilityPhase1 = {
  fixedCounts: AvailableDifficultyTestCounts;
  fixedCandidateKeys: Set<string>;
  remainingSlots: readonly DrawSlot[];
  remainingSlotDifficulties: Array<ReadonlySet<0 | 1 | 2>>;
  remainingCaps: AvailableDifficultyTestCounts;
  assignmentInput: PreparedDifficultyAssignmentInput;
  totalCount: number;
  /** isPatternAssignable の再構築に必要。Worker には渡さない。 */
  candidateIndex: CandidateIndex;
};

/**
 * BFS Worker の出力型。
 * Worker 側で patterns / ranges を組み立て、メインスレッド側で isPatternAssignable を付加する。
 */
export type BfsWorkerOutput = {
  patterns: FeasibleDifficultyPattern[];
  ranges: [DifficultyRange, DifficultyRange, DifficultyRange];
  assignableCountKeys: string[];
  rawPatternCount: number;
  exactFilteringDurationMs: number;
};

/**
 * testDataByNo から filter に合致する問題の難易度別数を集計する。
 */
export const collectAvailableTestCounts = (
  testDataByNo: ReadonlyMap<number, TestData>,
  filter: (td: TestData) => boolean,
): AvailableDifficultyTestCounts => {
  const availableTestCounts: AvailableDifficultyTestCounts = [0, 0, 0];
  for (const td of testDataByNo.values()) {
    if (!filter(td)) continue;
    const idx = Number(td.difficult) - 1;
    if (idx >= 0 && idx <= 2) availableTestCounts[idx]++;
  }
  return availableTestCounts;
};

/**
 * カテゴリ条件リストの union に合致する問題の難易度別集計。
 * Exam / Workbook 両モードで共通利用する。
 */
export const collectAvailableTestCountsByCategories = (
  testDataByNo: ReadonlyMap<number, TestData>,
  categories: ReadonlyArray<{ subject: string; big: string; small: string }>,
): AvailableDifficultyTestCounts => {
  const keySet = new Set(
    categories.map((c) => `${c.subject}::${c.big}::${c.small}`),
  );
  return collectAvailableTestCounts(
    testDataByNo,
    (td) =>
      td.active &&
      keySet.has(`${td.subject}::${td.bigCategoryTag}::${td.smallCategoryTag}`),
  );
};

/**
 * pct=[d0%,d1%,d2%]（個別割合）が選出可能かを検査する。
 * QandAnsApp の isUserSettableDifficult に相当。
 */
const isSettableDifficulty = (
  totalCount: number,
  availableTestCounts: AvailableDifficultyTestCounts,
  pct: readonly [number, number, number],
): boolean => {
  const counts = calcCountsFromRatio(totalCount, [pct[0], pct[0] + pct[1]]);
  return (
    availableTestCounts[0] >= counts[0] &&
    availableTestCounts[1] >= counts[1] &&
    availableTestCounts[2] >= counts[2]
  );
};

/**
 * availableTestCounts と totalCount から、設定可能な難易度割合の min/max を求める。
 * QandAnsApp の CalculateDifficulties に相当する 6方向探索版（補正版）。
 * 自然割合を起点として [-1,0,1] の全順列（6方向）を探索し、
 * 各方向で「最後に設定可能だった点」を境界として収集する。
 */
export const calcSettableDifficultyRanges = (
  totalCount: number,
  availableTestCounts: AvailableDifficultyTestCounts,
): [DifficultyRange, DifficultyRange, DifficultyRange] => {
  if (totalCount === 0) {
    return [
      { min: 0, max: 0 },
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ];
  }

  // 自然割合 [d0%, d1%, d2%] を起点に（QandAnsApp の GetDifficulties 相当）
  const total =
    availableTestCounts[0] + availableTestCounts[1] + availableTestCounts[2];
  const p0 =
    total > 0 ? Math.floor((availableTestCounts[0] / total) * 100) : 33;
  const p1 =
    total > 0 ? Math.floor((availableTestCounts[1] / total) * 100) : 33;
  const start: [number, number, number] = [p0, p1, 100 - p0 - p1];

  // [-1, 0, 1] の全順列（6方向）。各方向の合計 = 0 → 単体面上を移動
  const directions: ReadonlyArray<readonly [number, number, number]> = [
    [-1, 0, 1],
    [-1, 1, 0],
    [0, -1, 1],
    [0, 1, -1],
    [1, -1, 0],
    [1, 0, -1],
  ];

  const boundaryPcts: [number[], number[], number[]] = [[], [], []];

  for (const dir of directions) {
    let [d0, d1, d2] = start;
    // prev: 一歩前の設定可能点（起点自体を初期値とする）
    let [prev0, prev1, prev2] = start;
    for (let step = 0; step < 100; step++) {
      if (
        d0 < 0 ||
        d1 < 0 ||
        d2 < 0 ||
        d0 > 100 ||
        d1 > 100 ||
        d2 > 100 ||
        !isSettableDifficulty(totalCount, availableTestCounts, [d0, d1, d2])
      ) {
        // 「最後の設定可能点」（= 一歩前）を境界として記録
        boundaryPcts[0].push(prev0);
        boundaryPcts[1].push(prev1);
        boundaryPcts[2].push(prev2);
        break;
      }
      prev0 = d0;
      prev1 = d1;
      prev2 = d2;
      d0 += dir[0];
      d1 += dir[1];
      d2 += dir[2];
    }
  }

  return [0, 1, 2].map((i) => ({
    min: Math.min(...boundaryPcts[i]),
    max: Math.max(...boundaryPcts[i]),
  })) as [DifficultyRange, DifficultyRange, DifficultyRange];
};

/**
 * availableTestCounts から自然な難易度割合 [thumb1, thumb2] を算出する。
 * 「難易度計算」ボタン押下時のスライダー初期値として使用する。
 * availableTestCounts 合計が 0 の場合はデフォルト [30, 70] を返す。
 */
export const calcNaturalRatios = (
  availableTestCounts: AvailableDifficultyTestCounts,
): [number, number] => {
  const total =
    availableTestCounts[0] + availableTestCounts[1] + availableTestCounts[2];
  if (total === 0) return [30, 70];

  const pct: [number, number, number] = [
    Math.floor((availableTestCounts[0] / total) * 100),
    Math.floor((availableTestCounts[1] / total) * 100),
    0,
  ];
  pct[2] = 100 - pct[0] - pct[1];

  // thumb1 = d1%, thumb2 = d1% + d2%
  return [pct[0], pct[0] + pct[1]];
};

/**
 * naturalRatios を settableDifficultyRanges の制約に従ってクランプする。
 * calculateDifficulty の初期 ratios が固定行由来の min 下限を必ず満たすように使用する。
 *
 * クランプ順序:
 *  1. ⭐⭐⭐の min 制約: thumb2 ≤ 100 - ranges[2].min
 *  2. ⭐の min 制約:   thumb1 ≥ ranges[0].min
 *  3. r1 > r2 になった場合は thumb2 を r1 まで引き上げ（thumb1 ≤ thumb2 を保証）
 *  4. ⭐⭐の min 制約: thumb2 ≥ thumb1 + ranges[1].min
 *  5. 0〜100 に収める（制約が矛盾する場合のフェールセーフ）
 */
export const clampRatiosToRanges = (
  naturalRatios: [number, number],
  ranges: [DifficultyRange, DifficultyRange, DifficultyRange],
): [number, number] => {
  const clamp = (value: number, min: number, max: number): number => {
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    return Math.max(safeMin, Math.min(safeMax, value));
  };

  const [inputR1, inputR2] = naturalRatios;
  const r2MinByDifficulty3 = 100 - ranges[2].max;
  const r2MaxByDifficulty3 = 100 - ranges[2].min;

  const r1Min = Math.max(0, ranges[0].min, r2MinByDifficulty3 - ranges[1].max);
  const r1Max = Math.min(
    100,
    ranges[0].max,
    r2MaxByDifficulty3 - ranges[1].min,
  );
  const r1 = clamp(inputR1, r1Min, r1Max);

  const r2Min = Math.max(0, r1, r1 + ranges[1].min, r2MinByDifficulty3);
  const r2Max = Math.min(100, r1 + ranges[1].max, r2MaxByDifficulty3);
  const r2 = clamp(inputR2, r2Min, r2Max);

  return [r1, r2];
};

/**
 * スライダー位置 [thumb1, thumb2] から難易度別の出題数を計算する。
 * 端数は最大要素に加算。
 */
export const calcCountsFromRatio = (
  totalCount: number,
  ratios: [number, number],
): [number, number, number] => {
  const [t1, t2] = ratios;
  const pct: [number, number, number] = [t1, t2 - t1, 100 - t2];
  const counts: [number, number, number] = pct.map((p) =>
    Math.round((totalCount * p) / 100),
  ) as [number, number, number];
  // 端数補正: 合計が totalCount に一致するよう最大要素に差分を加算
  const maxIdx = counts.reduce((mi, v, i) => (v > counts[mi] ? i : mi), 0) as
    | 0
    | 1
    | 2;
  counts[maxIdx] += totalCount - (counts[0] + counts[1] + counts[2]);
  return counts;
};

export const calcRatiosFromCounts = (
  totalCount: number,
  counts: AvailableDifficultyTestCounts,
): [number, number] => {
  if (totalCount <= 0) return [30, 70];
  const difficulty1 = Math.max(
    0,
    Math.min(100, Math.round((counts[0] / totalCount) * 100)),
  );
  const difficulty2 = Math.max(
    difficulty1,
    Math.min(100, Math.round(((counts[0] + counts[1]) / totalCount) * 100)),
  );
  return [difficulty1, difficulty2];
};

export const createDifficultyCountKey = (
  counts: AvailableDifficultyTestCounts,
): string => counts.join(':');

const fromCountKey = (key: string): AvailableDifficultyTestCounts => {
  const parts = key.split(':').map((value) => Number(value));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

const toPercent = (count: number, totalCount: number): number =>
  totalCount <= 0 ? 0 : Math.round((count / totalCount) * 100);

const emptyRanges = (): [DifficultyRange, DifficultyRange, DifficultyRange] => [
  { min: 0, max: 0 },
  { min: 0, max: 0 },
  { min: 0, max: 0 },
];

const calcRangesFromPatterns = (
  totalCount: number,
  patterns: readonly FeasibleDifficultyPattern[],
): [DifficultyRange, DifficultyRange, DifficultyRange] => {
  if (totalCount <= 0 || patterns.length === 0) return emptyRanges();

  return ([0, 1, 2] as const).map((difficultyIndex) => {
    const values = patterns.map((pattern) => pattern.counts[difficultyIndex]);
    return {
      min: toPercent(Math.min(...values), totalCount),
      max: toPercent(Math.max(...values), totalCount),
    };
  }) as [DifficultyRange, DifficultyRange, DifficultyRange];
};

const calcRangeFromValues = (
  values: readonly number[],
): DifficultyRange | null => {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

/**
 * 片方の thumb を固定したまま、もう片方が取り得る範囲を計算する。
 * スライダー操作中に重い判定を走らせないため、計算済み assignable patterns だけを参照する。
 */
export const calcDifficultySliderDynamicBounds = (
  patterns: readonly FeasibleDifficultyPattern[],
  currentRatios: readonly [number, number],
): DifficultySliderDynamicBounds => {
  const [thumb1, thumb2] = currentRatios;
  return {
    thumb1: calcRangeFromValues(
      patterns
        .filter((pattern) => pattern.ratios[1] === thumb2)
        .map((pattern) => pattern.ratios[0]),
    ),
    thumb2: calcRangeFromValues(
      patterns
        .filter((pattern) => pattern.ratios[0] === thumb1)
        .map((pattern) => pattern.ratios[1]),
    ),
  };
};

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const getFixedCandidateKey = (
  slot: DrawSlot,
  candidateIndex: CandidateIndex,
): string | null => {
  if (slot.fixedNo === null) return null;
  const fixedNo = Number(slot.fixedNo);
  if (!Number.isFinite(fixedNo)) return null;
  if (slot.fixedChoiceIndex !== null) {
    return toCandidateKey(fixedNo, slot.fixedChoiceIndex);
  }
  const fixedEntries = candidateIndex.fixedEntriesByNo.get(fixedNo) ?? [];
  if (fixedEntries.length !== 1) return null;
  const entry = fixedEntries[0];
  return entry !== undefined
    ? toCandidateKey(entry.no, entry.choiceIndex)
    : null;
};

/** フェーズ1: slots × candidateIndex を走査して BFS 入力データを収集する（O(N×M)、軽い）。 */
export const prepareBfsFeasibility = (params: {
  slots: readonly DrawSlot[];
  candidateIndex: CandidateIndex;
}): BfsFeasibilityPhase1 => {
  const { slots, candidateIndex } = params;
  const fixedCounts: AvailableDifficultyTestCounts = [0, 0, 0];
  const fixedCandidateKeys = new Set<string>();
  const remainingSlots = slots.filter((slot) => slot.fixedNo === null);
  const remainingSlotDifficulties: Array<ReadonlySet<0 | 1 | 2>> = [];
  const remainingCandidateKeysByDifficulty: [
    Set<string>,
    Set<string>,
    Set<string>,
  ] = [new Set<string>(), new Set<string>(), new Set<string>()];

  for (const slot of slots) {
    if (slot.fixedNo !== null) {
      const fixedNo = Number(slot.fixedNo);
      const testData = candidateIndex.allByNo.get(fixedNo);
      const difficultyIndex = toDifficultyIndex(testData?.difficult);
      if (difficultyIndex !== null) fixedCounts[difficultyIndex] += 1;
      const fixedCandidateKey = getFixedCandidateKey(slot, candidateIndex);
      if (fixedCandidateKey !== null) fixedCandidateKeys.add(fixedCandidateKey);
    }
  }

  for (const slot of slots) {
    if (slot.fixedNo !== null) continue;
    const slotDifficulties = new Set<0 | 1 | 2>();
    for (const entry of resolveCandidates(
      candidateIndex,
      slot.subject,
      slot.conditions,
    )) {
      const candidateKey = toCandidateKey(entry.no, entry.choiceIndex);
      if (fixedCandidateKeys.has(candidateKey)) continue;
      const testData = candidateIndex.allByNo.get(entry.no);
      const difficultyIndex = toDifficultyIndex(testData?.difficult);
      if (difficultyIndex === null) continue;
      slotDifficulties.add(difficultyIndex);
      remainingCandidateKeysByDifficulty[difficultyIndex].add(candidateKey);
    }
    remainingSlotDifficulties.push(slotDifficulties);
  }

  return {
    fixedCounts,
    fixedCandidateKeys,
    remainingSlots,
    remainingSlotDifficulties,
    remainingCaps: [
      remainingCandidateKeysByDifficulty[0].size,
      remainingCandidateKeysByDifficulty[1].size,
      remainingCandidateKeysByDifficulty[2].size,
    ],
    assignmentInput: prepareDifficultyAssignmentInput({
      slots: remainingSlots,
      candidateIndex,
      usedCandidateKeys: fixedCandidateKeys,
    }),
    totalCount: slots.length,
    candidateIndex,
  };
};

/** フェーズ2: BFS本体。remainingSlotDifficulties と remainingCaps だけを使う純粋な数値計算（高価）。 */
export const runBfsFeasibility = (
  phase1: Pick<
    BfsFeasibilityPhase1,
    'remainingSlotDifficulties' | 'remainingCaps'
  >,
): Set<string> => {
  const { remainingSlotDifficulties, remainingCaps } = phase1;
  let states = new Set<string>([createDifficultyCountKey([0, 0, 0])]);

  for (const slotDifficulties of remainingSlotDifficulties) {
    if (slotDifficulties.size === 0) {
      states = new Set<string>();
      break;
    }

    const nextStates = new Set<string>();
    for (const state of states) {
      const counts = fromCountKey(state);
      for (const difficultyIndex of slotDifficulties) {
        const nextCounts: AvailableDifficultyTestCounts = [...counts];
        nextCounts[difficultyIndex] += 1;
        if (nextCounts[difficultyIndex] > remainingCaps[difficultyIndex]) {
          continue;
        }
        nextStates.add(createDifficultyCountKey(nextCounts));
      }
    }
    states = nextStates;
  }

  return states;
};

/** フェーズ2の BFS 結果から DifficultyFeasibility を組み立てる（メインスレッド同期パス用）。 */
export const assembleDifficultyFeasibility = (
  phase1: BfsFeasibilityPhase1,
  states: Set<string>,
): DifficultyFeasibility => {
  const { fixedCounts, fixedCandidateKeys, remainingSlots, candidateIndex } =
    phase1;
  const startedAt = now();
  const rawPatterns = [...states].map((state): FeasibleDifficultyPattern => {
    const remainingCounts = fromCountKey(state);
    const counts: AvailableDifficultyTestCounts = [
      fixedCounts[0] + remainingCounts[0],
      fixedCounts[1] + remainingCounts[1],
      fixedCounts[2] + remainingCounts[2],
    ];
    return {
      counts,
      ratios: calcRatiosFromCounts(phase1.totalCount, counts),
    };
  });
  const patterns = rawPatterns.filter((pattern) =>
    canAssignPreparedDifficultyCounts({
      input: phase1.assignmentInput,
      remainingCounts: [
        pattern.counts[0] - fixedCounts[0],
        pattern.counts[1] - fixedCounts[1],
        pattern.counts[2] - fixedCounts[2],
      ],
    }),
  );
  const assignableCountKeys = new Set(
    patterns.map((pattern) => createDifficultyCountKey(pattern.counts)),
  );

  return {
    totalCount: phase1.totalCount,
    fixedCounts,
    patterns,
    ranges: calcRangesFromPatterns(phase1.totalCount, patterns),
    assignableCountKeys,
    rawPatternCount: rawPatterns.length,
    exactFilteringDurationMs: now() - startedAt,
    isPatternAssignable: (counts) => {
      const key = createDifficultyCountKey(counts);
      if (assignableCountKeys.has(key)) return true;
      return canAssignDifficultyCounts({
        slots: remainingSlots,
        candidateIndex,
        usedCandidateKeys: fixedCandidateKeys,
        remainingCounts: [
          counts[0] - fixedCounts[0],
          counts[1] - fixedCounts[1],
          counts[2] - fixedCounts[2],
        ],
      });
    },
  };
};

/**
 * Worker 出力から DifficultyFeasibility を組み立てる（Worker 非同期パス用）。
 * isPatternAssignable は phase1 のクロージャで再構築する（candidateIndex は転送不要）。
 */
export const assembleDifficultyFeasibilityFromWorker = (
  phase1: BfsFeasibilityPhase1,
  output: BfsWorkerOutput,
): DifficultyFeasibility => {
  const {
    fixedCounts,
    fixedCandidateKeys,
    remainingSlots,
    candidateIndex,
    totalCount,
  } = phase1;
  return {
    totalCount,
    fixedCounts,
    patterns: output.patterns,
    ranges: output.ranges,
    assignableCountKeys: new Set(output.assignableCountKeys),
    rawPatternCount: output.rawPatternCount,
    exactFilteringDurationMs: output.exactFilteringDurationMs,
    isPatternAssignable: (counts) => {
      const key = createDifficultyCountKey(counts);
      if (output.assignableCountKeys.includes(key)) return true;
      const remainingCounts: AvailableDifficultyTestCounts = [
        counts[0] - fixedCounts[0],
        counts[1] - fixedCounts[1],
        counts[2] - fixedCounts[2],
      ];
      return canAssignDifficultyCounts({
        slots: remainingSlots,
        candidateIndex,
        usedCandidateKeys: fixedCandidateKeys,
        remainingCounts,
      });
    },
  };
};

/**
 * フェーズ1完了後に BFS のコストを見積もる。
 * BFS_WORKER_COST_THRESHOLD と比較して Worker 使用を決定する。
 */
export const estimateBfsCost = (
  remainingSlotDifficultiesLength: number,
  remainingCaps: [number, number, number],
): number =>
  remainingSlotDifficultiesLength *
  (remainingCaps[0] + 1) *
  (remainingCaps[1] + 1) *
  (remainingCaps[2] + 1);

/** この見積もりコスト以上で Worker を使用する */
export const BFS_WORKER_COST_THRESHOLD = 500_000;

/**
 * @deprecated T8・T9 の Worker 対応完了後は prepareBfsFeasibility + runBfsFeasibility を直接使用してください。
 * 現在は後方互換のためラッパーとして残す。
 */
export const buildDifficultyFeasibility = (params: {
  slots: readonly DrawSlot[];
  candidateIndex: CandidateIndex;
}): DifficultyFeasibility => {
  const phase1 = prepareBfsFeasibility(params);
  const states = runBfsFeasibility(phase1);
  return assembleDifficultyFeasibility(phase1, states);
};

const calcCountDistance = (
  left: AvailableDifficultyTestCounts,
  right: AvailableDifficultyTestCounts,
): number =>
  Math.abs(left[0] - right[0]) +
  Math.abs(left[1] - right[1]) +
  Math.abs(left[2] - right[2]);

const calcRatioDistance = (
  left: [number, number],
  right: [number, number],
): number => Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]);

export const DEFAULT_NEAREST_PATTERN_MAX_COUNT_DISTANCE = 2;

export const findNearestAssignablePattern = (params: {
  patterns: readonly FeasibleDifficultyPattern[];
  totalCount: number;
  ratios: [number, number];
  maxCountDistance?: number;
}): FeasibleDifficultyPattern | null => {
  const {
    patterns,
    totalCount,
    ratios,
    maxCountDistance = DEFAULT_NEAREST_PATTERN_MAX_COUNT_DISTANCE,
  } = params;
  if (totalCount <= 0 || patterns.length === 0) return null;

  const targetCounts = calcCountsFromRatio(totalCount, ratios);
  const selectedPattern = [...patterns].sort((left, right) => {
    const leftCountDistance = calcCountDistance(left.counts, targetCounts);
    const rightCountDistance = calcCountDistance(right.counts, targetCounts);
    if (leftCountDistance !== rightCountDistance) {
      return leftCountDistance - rightCountDistance;
    }
    return (
      calcRatioDistance(left.ratios, ratios) -
      calcRatioDistance(right.ratios, ratios)
    );
  })[0];

  if (selectedPattern === undefined) return null;
  if (
    calcCountDistance(selectedPattern.counts, targetCounts) > maxCountDistance
  ) {
    return null;
  }
  return selectedPattern;
};

export const adjustDifficultyByFeasibility = (params: {
  ratios: [number, number];
  feasibility: DifficultyFeasibility;
}): {
  ratios: [number, number];
  entityCount: AvailableDifficultyTestCounts;
  settableDifficultyRanges: [DifficultyRange, DifficultyRange, DifficultyRange];
} => {
  const { ratios, feasibility } = params;
  if (feasibility.totalCount <= 0 || feasibility.patterns.length === 0) {
    return {
      ratios,
      entityCount: [0, 0, 0],
      settableDifficultyRanges: feasibility.ranges,
    };
  }

  const targetCounts = calcCountsFromRatio(feasibility.totalCount, ratios);
  const sortedPatterns = [...feasibility.patterns].sort((left, right) => {
    const leftCountDistance = calcCountDistance(left.counts, targetCounts);
    const rightCountDistance = calcCountDistance(right.counts, targetCounts);
    if (leftCountDistance !== rightCountDistance) {
      return leftCountDistance - rightCountDistance;
    }
    return (
      calcRatioDistance(left.ratios, ratios) -
      calcRatioDistance(right.ratios, ratios)
    );
  });
  const selectedPattern = sortedPatterns[0];

  if (selectedPattern === undefined) {
    return {
      ratios,
      entityCount: [0, 0, 0],
      settableDifficultyRanges: feasibility.ranges,
    };
  }

  return {
    ratios: selectedPattern.ratios,
    entityCount: selectedPattern.counts,
    settableDifficultyRanges: feasibility.ranges,
  };
};

/** この値以上の totalCount で抽選ローディングオーバーレイを表示する */
export const DRAW_LOADING_THRESHOLD = 200;

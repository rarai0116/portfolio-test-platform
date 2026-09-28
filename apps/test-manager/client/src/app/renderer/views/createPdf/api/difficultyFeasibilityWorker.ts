/// <reference lib="webworker" />

import { canAssignPreparedDifficultyCounts } from '@views/createPdf/api/difficultyAssignment';
import type { AvailableDifficultyTestCounts } from '@views/createPdf/api/difficultyUtils';
import {
  type BfsWorkerOutput,
  calcRatiosFromCounts,
  type FeasibleDifficultyPattern,
  runBfsFeasibility,
} from '@views/createPdf/api/difficultyUtils';
import type { DifficultyRange } from '@views/createPdf/types/draftState';

/** Worker 入力型。Set<0|1|2> は Array<(0|1|2)[]> に変換して転送する */
type BfsWorkerInput = {
  remainingSlotDifficulties: (0 | 1 | 2)[][];
  remainingCaps: [number, number, number];
  fixedCounts: [number, number, number];
  totalCount: number;
  slotCandidateKeys: string[][];
  candidateDifficultyByKey: Array<[string, 0 | 1 | 2]>;
  usedCandidateCount: number;
};

const fromCountKey = (key: string): AvailableDifficultyTestCounts => {
  const parts = key.split(':').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

const calcRangesFromPatterns = (
  totalCount: number,
  patterns: readonly FeasibleDifficultyPattern[],
): [DifficultyRange, DifficultyRange, DifficultyRange] => {
  if (totalCount <= 0 || patterns.length === 0) {
    return [
      { min: 0, max: 0 },
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ];
  }
  const toPercent = (count: number): number =>
    totalCount <= 0 ? 0 : Math.round((count / totalCount) * 100);

  return ([0, 1, 2] as const).map((i) => {
    const values = patterns.map((p) => p.counts[i]);
    return {
      min: toPercent(Math.min(...values)),
      max: toPercent(Math.max(...values)),
    };
  }) as [DifficultyRange, DifficultyRange, DifficultyRange];
};

self.onmessage = (event: MessageEvent<BfsWorkerInput>) => {
  const {
    remainingSlotDifficulties,
    remainingCaps,
    fixedCounts,
    totalCount,
    slotCandidateKeys,
    candidateDifficultyByKey,
    usedCandidateCount,
  } = event.data;

  // Array<(0|1|2)[]> → Array<ReadonlySet<0|1|2>> に変換して runBfsFeasibility に渡す
  const slotDifficultiesAsSets = remainingSlotDifficulties.map(
    (arr) => new Set(arr) as ReadonlySet<0 | 1 | 2>,
  );

  const states = runBfsFeasibility({
    remainingSlotDifficulties: slotDifficultiesAsSets,
    remainingCaps,
  });

  const rawPatterns = [...states].map((state): FeasibleDifficultyPattern => {
    const remainingCounts = fromCountKey(state);
    const counts: AvailableDifficultyTestCounts = [
      fixedCounts[0] + remainingCounts[0],
      fixedCounts[1] + remainingCounts[1],
      fixedCounts[2] + remainingCounts[2],
    ];
    return { counts, ratios: calcRatiosFromCounts(totalCount, counts) };
  });
  const startedAt = performance.now();
  const assignmentInput = {
    slotCandidateKeys,
    candidateDifficultyByKey: new Map(candidateDifficultyByKey),
    usedCandidateCount,
  };
  const patterns = rawPatterns.filter((pattern) =>
    canAssignPreparedDifficultyCounts({
      input: assignmentInput,
      remainingCounts: [
        pattern.counts[0] - fixedCounts[0],
        pattern.counts[1] - fixedCounts[1],
        pattern.counts[2] - fixedCounts[2],
      ],
    }),
  );

  const output: BfsWorkerOutput = {
    patterns,
    ranges: calcRangesFromPatterns(totalCount, patterns),
    assignableCountKeys: patterns.map((pattern) => pattern.counts.join(':')),
    rawPatternCount: rawPatterns.length,
    exactFilteringDurationMs: performance.now() - startedAt,
  };

  self.postMessage(output);
};

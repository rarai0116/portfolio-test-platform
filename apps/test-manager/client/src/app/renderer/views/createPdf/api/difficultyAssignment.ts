import {
  type CandidateEntry,
  type CandidateIndex,
  resolveCandidates,
  toCandidateKey,
} from '@views/createPdf/api/candidateIndex';
import type { CategoryCondition } from '@views/createPdf/types/draftState';

export type DifficultyCounts = [number, number, number];

export type DifficultyAssignableSlot = {
  id: string;
  subject: string;
  conditions: readonly CategoryCondition[];
};

type FlowEdge = {
  to: number;
  rev: number;
  cap: number;
};

type DifficultyAssignmentResult =
  | { ok: true; assignments: Map<string, CandidateEntry> }
  | { ok: false };

export type PreparedDifficultyAssignmentInput = {
  slotCandidateKeys: readonly (readonly string[])[];
  candidateDifficultyByKey: ReadonlyMap<string, 0 | 1 | 2>;
  candidateByKey?: ReadonlyMap<string, CandidateEntry>;
  usedCandidateCount?: number;
};

export const serializePreparedDifficultyAssignmentInput = (
  input: PreparedDifficultyAssignmentInput,
): {
  slotCandidateKeys: string[][];
  candidateDifficultyByKey: Array<[string, 0 | 1 | 2]>;
  usedCandidateCount: number;
} => ({
  slotCandidateKeys: input.slotCandidateKeys.map((keys) => [...keys]),
  candidateDifficultyByKey: [...input.candidateDifficultyByKey.entries()],
  usedCandidateCount: input.usedCandidateCount ?? 0,
});

export const prepareDifficultyAssignmentInput = (params: {
  slots: readonly DifficultyAssignableSlot[];
  candidateIndex: CandidateIndex;
  usedCandidateKeys: ReadonlySet<string>;
}): PreparedDifficultyAssignmentInput => {
  const { slots, candidateIndex, usedCandidateKeys } = params;
  const candidateDifficultyByKey = new Map<string, 0 | 1 | 2>();
  const candidateByKey = new Map<string, CandidateEntry>();
  const slotCandidateKeys: string[][] = [];

  for (const slot of slots) {
    const keys: string[] = [];
    for (const entry of resolveCandidates(
      candidateIndex,
      slot.subject,
      slot.conditions,
    )) {
      const candidateKey = toCandidateKey(entry.no, entry.choiceIndex);
      if (usedCandidateKeys.has(candidateKey)) continue;
      const testData = candidateIndex.allByNo.get(entry.no);
      const difficultyIndex = toDifficultyIndex(testData?.difficult);
      if (difficultyIndex === null) continue;
      candidateDifficultyByKey.set(candidateKey, difficultyIndex);
      candidateByKey.set(candidateKey, entry);
      keys.push(candidateKey);
    }
    slotCandidateKeys.push(keys);
  }

  return {
    slotCandidateKeys,
    candidateDifficultyByKey,
    candidateByKey,
    usedCandidateCount: usedCandidateKeys.size,
  };
};

type PreparedFlowResult =
  | {
      ok: true;
      graph: FlowEdge[][];
      slotOffset: number;
      candidateOffset: number;
      difficultyOffset: number;
      candidateKeyByNode: Map<number, string>;
    }
  | { ok: false };

const runPreparedDifficultyAssignmentFlow = (params: {
  input: PreparedDifficultyAssignmentInput;
  remainingCounts: DifficultyCounts;
}): PreparedFlowResult => {
  const { input, remainingCounts } = params;
  const slotCount = input.slotCandidateKeys.length;
  const requiredCount =
    remainingCounts[0] + remainingCounts[1] + remainingCounts[2];
  const isInvalidRequest =
    remainingCounts.some((count) => count < 0) || requiredCount !== slotCount;
  if (isInvalidRequest) {
    return { ok: false };
  }
  if (slotCount === 0) {
    return {
      ok: true,
      graph: [[]],
      slotOffset: 1,
      candidateOffset: 1,
      difficultyOffset: 1,
      candidateKeyByNode: new Map(),
    };
  }

  const source = 0;
  const slotOffset = 1;
  const candidateOffset = slotOffset + slotCount;
  const candidateKeyToNode = new Map<string, number>();
  const candidateKeyByNode = new Map<number, string>();

  for (const keys of input.slotCandidateKeys) {
    for (const candidateKey of keys) {
      if (candidateKeyToNode.has(candidateKey)) continue;
      const difficultyIndex = input.candidateDifficultyByKey.get(candidateKey);
      if (difficultyIndex === undefined) continue;
      const candidateNode = candidateOffset + candidateKeyToNode.size;
      candidateKeyToNode.set(candidateKey, candidateNode);
      candidateKeyByNode.set(candidateNode, candidateKey);
    }
  }

  const difficultyOffset = candidateOffset + candidateKeyToNode.size;
  const sink = difficultyOffset + 3;
  const graph = Array.from({ length: sink + 1 }, () => [] as FlowEdge[]);

  input.slotCandidateKeys.forEach((keys, slotIndex) => {
    const slotNode = slotOffset + slotIndex;
    addEdge(graph, source, slotNode, 1);
    for (const candidateKey of keys) {
      const candidateNode = candidateKeyToNode.get(candidateKey);
      if (candidateNode !== undefined)
        addEdge(graph, slotNode, candidateNode, 1);
    }
  });

  for (const [candidateKey, candidateNode] of candidateKeyToNode) {
    const difficultyIndex = input.candidateDifficultyByKey.get(candidateKey);
    if (difficultyIndex !== undefined) {
      addEdge(graph, candidateNode, difficultyOffset + difficultyIndex, 1);
    }
  }

  addEdge(graph, difficultyOffset, sink, remainingCounts[0]);
  addEdge(graph, difficultyOffset + 1, sink, remainingCounts[1]);
  addEdge(graph, difficultyOffset + 2, sink, remainingCounts[2]);

  const flow = maxFlow(graph, source, sink);
  if (flow !== slotCount) {
    return { ok: false };
  }

  return {
    ok: true,
    graph,
    slotOffset,
    candidateOffset,
    difficultyOffset,
    candidateKeyByNode,
  };
};

export const canAssignPreparedDifficultyCounts = (params: {
  input: PreparedDifficultyAssignmentInput;
  remainingCounts: DifficultyCounts;
}): boolean =>
  runPreparedDifficultyAssignmentFlow({
    input: params.input,
    remainingCounts: params.remainingCounts,
  }).ok;

export const toDifficultyIndex = (value: unknown): 0 | 1 | 2 | null => {
  const index = Number(value) - 1;
  return index >= 0 && index <= 2 ? (index as 0 | 1 | 2) : null;
};

const addEdge = (
  graph: FlowEdge[][],
  from: number,
  to: number,
  cap: number,
): void => {
  const forward: FlowEdge = { to, rev: graph[to]?.length ?? 0, cap };
  const backward: FlowEdge = {
    to: from,
    rev: graph[from]?.length ?? 0,
    cap: 0,
  };
  graph[from]?.push(forward);
  graph[to]?.push(backward);
};

const maxFlow = (graph: FlowEdge[][], source: number, sink: number): number => {
  let flow = 0;

  while (true) {
    const level = Array<number>(graph.length).fill(-1);
    const queue = [source];
    level[source] = 0;

    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head] as number;
      for (const edge of graph[node] ?? []) {
        if (edge.cap <= 0 || level[edge.to] >= 0) continue;
        level[edge.to] = level[node] + 1;
        queue.push(edge.to);
      }
    }

    if (level[sink] < 0) return flow;

    const iter = Array<number>(graph.length).fill(0);
    const dfs = (node: number, amount: number): number => {
      if (node === sink) return amount;

      for (
        let edgeIndex = iter[node];
        edgeIndex < (graph[node]?.length ?? 0);
        edgeIndex += 1
      ) {
        iter[node] = edgeIndex;
        const edge = graph[node]?.[edgeIndex];
        if (
          edge === undefined ||
          edge.cap <= 0 ||
          level[node] >= level[edge.to]
        )
          continue;

        const pushed = dfs(edge.to, Math.min(amount, edge.cap));
        if (pushed <= 0) continue;
        edge.cap -= pushed;
        const reverse = graph[edge.to]?.[edge.rev];
        if (reverse !== undefined) reverse.cap += pushed;
        return pushed;
      }

      return 0;
    };

    while (true) {
      const pushed = dfs(source, Number.POSITIVE_INFINITY);
      if (pushed <= 0) break;
      flow += pushed;
    }
  }
};

export const findDifficultyAssignment = (params: {
  slots: readonly DifficultyAssignableSlot[];
  candidateIndex: CandidateIndex;
  usedCandidateKeys: ReadonlySet<string>;
  remainingCounts: DifficultyCounts;
}): DifficultyAssignmentResult => {
  const { slots, candidateIndex, usedCandidateKeys, remainingCounts } = params;
  const prepared = prepareDifficultyAssignmentInput({
    slots,
    candidateIndex,
    usedCandidateKeys,
  });
  const flowResult = runPreparedDifficultyAssignmentFlow({
    input: prepared,
    remainingCounts,
  });
  if (!flowResult.ok) return { ok: false };

  const assignments = new Map<string, CandidateEntry>();
  slots.forEach((slot, slotIndex) => {
    const slotNode = flowResult.slotOffset + slotIndex;
    for (const edge of flowResult.graph[slotNode] ?? []) {
      if (
        edge.to < flowResult.candidateOffset ||
        edge.to >= flowResult.difficultyOffset
      )
        continue;
      const reverse = flowResult.graph[edge.to]?.[edge.rev];
      if (reverse === undefined || reverse.cap <= 0) continue;
      const candidateKey = flowResult.candidateKeyByNode.get(edge.to);
      const candidate =
        candidateKey !== undefined
          ? prepared.candidateByKey?.get(candidateKey)
          : undefined;
      if (candidate !== undefined) {
        assignments.set(slot.id, candidate);
        break;
      }
    }
  });

  return assignments.size === slots.length
    ? { ok: true, assignments }
    : { ok: false };
};

export const canAssignDifficultyCounts = (params: {
  slots: readonly DifficultyAssignableSlot[];
  candidateIndex: CandidateIndex;
  usedCandidateKeys: ReadonlySet<string>;
  remainingCounts: DifficultyCounts;
}): boolean => {
  const prepared = prepareDifficultyAssignmentInput(params);
  return canAssignPreparedDifficultyCounts({
    input: prepared,
    remainingCounts: params.remainingCounts,
  });
};

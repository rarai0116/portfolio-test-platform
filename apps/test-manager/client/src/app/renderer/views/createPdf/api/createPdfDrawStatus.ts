import {
  type CandidateIndex,
  normalizeQaaChoiceIndex,
  resolveCandidates,
  toCandidateKey,
} from '@views/createPdf/api/candidateIndex';
import {
  createCreatePdfStatusReason,
  dedupeStatusReasons,
} from '@views/createPdf/api/createPdfStatusReasons';
import { getDrawBlockingTestTableReasons } from '@views/createPdf/api/createPdfTestTableChecks';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type {
  CreatePdfDrawStatus,
  CreatePdfStatusReason,
  CreatePdfTestTableCheckSnapshot,
} from '@views/createPdf/types/statusState';
import type { TestTableRow } from '@views/createPdf/types/testTable';

type DeriveCreatePdfDrawStatusParams = {
  hasCategoryConditions: boolean;
  candidateIndex: CandidateIndex;
  testTableChecks: CreatePdfTestTableCheckSnapshot;
  slots: readonly DrawSlot[];
  fixedRows: readonly TestTableRow[];
  conditionRequirements: ReadonlyMap<string, number>;
  isBfsCalculating: boolean;
};

const getFixedCandidateKeys = (
  fixedRows: readonly TestTableRow[],
  candidateIndex: CandidateIndex,
): ReadonlySet<string> => {
  const fixedKeys = new Set<string>();
  for (const row of fixedRows) {
    if (!row.isFixed || row.selectedNo === null) continue;
    const selectedNo = Number(row.selectedNo);
    if (!Number.isFinite(selectedNo)) continue;
    const qaaChoiceIndex = normalizeQaaChoiceIndex(row.qaaChoiceIndex);
    if (qaaChoiceIndex !== null) {
      fixedKeys.add(toCandidateKey(selectedNo, qaaChoiceIndex));
      continue;
    }
    const fixedEntries = candidateIndex.fixedEntriesByNo.get(selectedNo) ?? [];
    if (fixedEntries.length === 1) {
      const entry = fixedEntries[0];
      if (entry !== undefined)
        fixedKeys.add(toCandidateKey(entry.no, entry.choiceIndex));
    }
  }
  return fixedKeys;
};

const deriveFixedCountExceededReasons = (params: {
  fixedRows: readonly TestTableRow[];
  conditionRequirements: ReadonlyMap<string, number>;
}): CreatePdfStatusReason[] => {
  const fixedCountsByConditionId = new Map<string, number>();
  for (const row of params.fixedRows) {
    if (
      !row.isFixed ||
      row.selectedNo === null ||
      row.sourceConditionId === null
    ) {
      continue;
    }
    fixedCountsByConditionId.set(
      row.sourceConditionId,
      (fixedCountsByConditionId.get(row.sourceConditionId) ?? 0) + 1,
    );
  }

  const reasons: CreatePdfStatusReason[] = [];
  for (const [conditionId, fixedCount] of fixedCountsByConditionId) {
    const requirement = params.conditionRequirements.get(conditionId);
    if (requirement === undefined || fixedCount <= requirement) continue;
    reasons.push(
      createCreatePdfStatusReason({
        code: 'draw-fixed-count-exceeded',
        severity: 'blocking',
        message: `固定行が条件の指定数を超えています。条件ID: ${conditionId}`,
        target: { conditionId },
      }),
    );
  }
  return reasons;
};

const buildSlotCandidateGroupKey = (slot: DrawSlot): string =>
  JSON.stringify({ subject: slot.subject, conditions: slot.conditions });

const deriveCandidateShortageReasons = (params: {
  slots: readonly DrawSlot[];
  candidateIndex: CandidateIndex;
  fixedCandidateKeys: ReadonlySet<string>;
}): CreatePdfStatusReason[] => {
  const groups = new Map<
    string,
    { firstSlot: DrawSlot; demand: number; candidateKeys: Set<string> }
  >();

  for (const slot of params.slots) {
    if (slot.fixedNo !== null) continue;
    const candidateKeys = new Set(
      resolveCandidates(params.candidateIndex, slot.subject, slot.conditions)
        .map((entry) => toCandidateKey(entry.no, entry.choiceIndex))
        .filter((key) => !params.fixedCandidateKeys.has(key)),
    );
    const key = buildSlotCandidateGroupKey(slot);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { firstSlot: slot, demand: 1, candidateKeys });
      continue;
    }
    group.demand += 1;
    for (const candidateKey of candidateKeys) {
      group.candidateKeys.add(candidateKey);
    }
  }

  const reasons: CreatePdfStatusReason[] = [];
  for (const group of groups.values()) {
    if (group.candidateKeys.size >= group.demand) continue;
    reasons.push(
      createCreatePdfStatusReason({
        code: 'draw-candidate-empty',
        severity: 'blocking',
        message:
          group.candidateKeys.size === 0
            ? '抽選対象の問題がありません。'
            : '条件に合う抽選対象の問題数が必要数を下回っています。',
        target: { slotId: group.firstSlot.id },
      }),
    );
  }
  return reasons;
};

export const deriveCreatePdfDrawStatus = ({
  hasCategoryConditions,
  candidateIndex,
  testTableChecks,
  slots,
  fixedRows,
  conditionRequirements,
  isBfsCalculating,
}: DeriveCreatePdfDrawStatusParams): CreatePdfDrawStatus => {
  const blockingReasons: CreatePdfStatusReason[] = [];

  if (isBfsCalculating) {
    blockingReasons.push(
      createCreatePdfStatusReason({
        code: 'draw-bfs-calculating',
        severity: 'blocking',
      }),
    );
  }

  if (!hasCategoryConditions) {
    blockingReasons.push(
      createCreatePdfStatusReason({
        code: 'draw-category-missing',
        severity: 'blocking',
        message:
          '抽選条件のカテゴリが設定されていません。抽選条件を設定してください。',
      }),
    );
  }

  const fixedCandidateKeys = getFixedCandidateKeys(fixedRows, candidateIndex);

  blockingReasons.push(...getDrawBlockingTestTableReasons(testTableChecks));
  blockingReasons.push(
    ...deriveFixedCountExceededReasons({ fixedRows, conditionRequirements }),
  );
  blockingReasons.push(
    ...deriveCandidateShortageReasons({
      slots,
      candidateIndex,
      fixedCandidateKeys,
    }),
  );

  const uniqueBlockingReasons = dedupeStatusReasons(blockingReasons);

  return {
    kind: uniqueBlockingReasons.length > 0 ? 'blocked' : 'ready',
    canDraw: uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
  };
};

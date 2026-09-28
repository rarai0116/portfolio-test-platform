import type { CreatePdfDrawConditionChangeStatus } from '@views/createPdf/types/statusState';

export const deriveCreatePdfDrawConditionChangeStatus = (params: {
  currentDrawConditionKey: string | null;
  lastAppliedDrawConditionKey: string | null;
  /** テーブルに1行以上あるか。false なら常に not-drawn */
  hasOutputRows: boolean;
}): CreatePdfDrawConditionChangeStatus => {
  const {
    currentDrawConditionKey,
    lastAppliedDrawConditionKey,
    hasOutputRows,
  } = params;

  // 行なし = 未抽選状態として扱う
  if (!hasOutputRows) {
    return {
      kind: 'not-drawn',
      hasUnappliedDrawConditions: false,
      currentDrawConditionKey,
      lastAppliedDrawConditionKey: null,
    };
  }

  // 行あり: lastAppliedKey が null（JSONリストア含む）または条件不一致なら changed
  const hasUnappliedDrawConditions =
    lastAppliedDrawConditionKey === null ||
    currentDrawConditionKey !== lastAppliedDrawConditionKey;
  return {
    kind: hasUnappliedDrawConditions ? 'changed' : 'clean',
    hasUnappliedDrawConditions,
    currentDrawConditionKey,
    lastAppliedDrawConditionKey,
  };
};

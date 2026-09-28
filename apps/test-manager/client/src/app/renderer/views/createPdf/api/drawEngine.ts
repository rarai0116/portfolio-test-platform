import { createCreatePdfId } from '@views/createPdf/api/common';
import { createEmptyTestTableRow } from '@views/createPdf/api/testTableRows';
import type {
  CategoryCondition,
  CreatePdfDifficultyDraftState,
  ExamCategoryTableRow,
} from '@views/createPdf/types/draftState';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import type { WorkbookCategoryTableRow } from '@views/createPdf/types/viewState';
import {
  type CandidateIndex,
  normalizeQaaChoiceIndex,
  resolveCandidates,
  toCandidateKey,
} from './candidateIndex';
import { findDifficultyAssignment } from './difficultyAssignment';

/**
 * 抽選の1枠。フェーズ1でスロットに展開し、フェーズ2で selectedNo を決定する。
 * 設計書の DrawSlot 型に subject を追加: CategoryCondition は big/small のみ持つため、
 * resolveCandidates の呼び出しに subject を別途保持する必要がある。
 */
export type DrawSlot = {
  id: string;
  /** テーブル行の sourceConditionId に書き込む値。孤立固定行は null */
  sourceConditionId: string | null;
  /**
   * 候補インデックス参照に使用する学科。
   * 孤立固定行（sourceConditionId=null）の場合は '' とし、conditions も空にする。
   */
  subject: string;
  /** 1件 = exact match、複数件 = OR 条件、空 = その学科全体（またはフルスキャン） */
  conditions: readonly CategoryCondition[];
  /** 再抽選時の固定行のみ非 null */
  fixedNo:
    | string
    | null /** v2 追加。非 null: No+choiceIndex 両方固定。null: No のみ固定、choiceIndex は再抽選 */;
  fixedChoiceIndex: number | null;
};

export type DrawResult = {
  /** 生成されたテーブル行（section 1 つ分の rows） */
  rows: TestTableRow[];
  hasError: boolean;
  /** 候補不足など失敗した枠の情報 */
  errorRows: { slotId: string; message: string }[];
};

/** Fisher-Yates シャッフル（コピーを返す） */
const shuffleArray = <T>(arr: readonly T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j] as T;
    result[j] = tmp as T;
  }
  return result;
};

const summarizeSlot = (slot: DrawSlot) => ({
  slotId: slot.id,
  subject: slot.subject,
  conditionCount: slot.conditions.length,
  conditions: slot.conditions.map(
    (condition) =>
      `${condition.big}${condition.small ? `/${condition.small}` : ''}`,
  ),
  fixedNo: slot.fixedNo,
  fixedChoiceIndex: slot.fixedChoiceIndex,
});

/**
 * Workbook: 条件テーブル + 固定行 → DrawSlot[]
 * 各条件行を count 分だけスロットに展開する。
 * 固定行は sourceConditionId で対応する条件行に紐付ける。
 * sourceConditionId が削除済みの固定行（孤立固定行）は末尾に追加し、
 * fixedNo を維持しつつ sourceConditionId = null とする（§5 B 項）。
 */
export const buildWorkbookDrawSlots = (
  conditions: readonly WorkbookCategoryTableRow[],
  fixedRows: readonly TestTableRow[],
  /**
   * 再抽選前の全テーブル行（条件 ID ごとの元の並び順）。
   * 渡された場合、固定行を元の位置に保持してスロットを生成する。
   * 省略または空配列の場合は旧ロジック（固定スロット先頭）にフォールバックする。
   */
  allRows: readonly TestTableRow[] = [],
): DrawSlot[] => {
  const conditionIdSet = new Set(conditions.map((c) => c.id));

  // 孤立固定行: sourceConditionId が null または削除済み条件行を指す
  const orphanedFixed: TestTableRow[] = [];
  for (const row of fixedRows) {
    if (!row.isFixed || row.selectedNo === null) continue;
    if (
      row.sourceConditionId === null ||
      !conditionIdSet.has(row.sourceConditionId)
    ) {
      orphanedFixed.push(row);
    }
  }

  const slots: DrawSlot[] = [];

  if (allRows.length > 0) {
    // 位置保持モード: allRows の順序に従って固定/非固定スロットを配置する
    const allRowsByConditionId = new Map<string, TestTableRow[]>();
    for (const row of allRows) {
      if (row.sourceConditionId === null) continue;
      const list = allRowsByConditionId.get(row.sourceConditionId) ?? [];
      list.push(row);
      allRowsByConditionId.set(row.sourceConditionId, list);
    }

    for (const condition of conditions) {
      if (condition.subject === null || condition.bigCategoryTag === null)
        continue;

      const requestedCount = Math.max(0, condition.count);
      const condRows = allRowsByConditionId.get(condition.id) ?? [];

      for (let i = 0; i < requestedCount; i += 1) {
        const existingRow = condRows[i];
        const isFixed =
          existingRow?.isFixed === true && existingRow.selectedNo !== null;
        slots.push({
          id: createCreatePdfId('draw-slot'),
          subject: condition.subject,
          sourceConditionId: condition.id,
          conditions: [
            {
              big: condition.bigCategoryTag,
              small: condition.smallCategoryTag,
            },
          ],
          fixedNo: isFixed ? (existingRow?.selectedNo ?? null) : null,
          fixedChoiceIndex: isFixed
            ? normalizeQaaChoiceIndex(existingRow?.qaaChoiceIndex ?? null)
            : null,
        });
      }
    }
  } else {
    // 旧ロジック: 固定スロット先頭 → 非固定スロット末尾
    // 有効固定行を条件 ID でグループ化
    const fixedByConditionId = new Map<string, TestTableRow[]>();
    for (const row of fixedRows) {
      if (!row.isFixed || row.selectedNo === null) continue;
      if (
        row.sourceConditionId === null ||
        !conditionIdSet.has(row.sourceConditionId)
      )
        continue;
      const list = fixedByConditionId.get(row.sourceConditionId) ?? [];
      list.push(row);
      fixedByConditionId.set(row.sourceConditionId, list);
    }

    for (const condition of conditions) {
      if (condition.subject === null || condition.bigCategoryTag === null)
        continue;

      const requestedCount = Math.max(0, condition.count);
      const fixed = fixedByConditionId.get(condition.id) ?? [];
      const fixedCount = Math.min(fixed.length, requestedCount);

      for (let i = 0; i < fixedCount; i += 1) {
        slots.push({
          id: createCreatePdfId('draw-slot'),
          subject: condition.subject,
          sourceConditionId: condition.id,
          conditions: [
            {
              big: condition.bigCategoryTag,
              small: condition.smallCategoryTag,
            },
          ],
          fixedNo: fixed[i]?.selectedNo ?? null,
          fixedChoiceIndex: normalizeQaaChoiceIndex(
            fixed[i]?.qaaChoiceIndex ?? null,
          ),
        });
      }

      const remainCount = requestedCount - fixedCount;
      for (let i = 0; i < remainCount; i += 1) {
        slots.push({
          id: createCreatePdfId('draw-slot'),
          subject: condition.subject,
          sourceConditionId: condition.id,
          conditions: [
            {
              big: condition.bigCategoryTag,
              small: condition.smallCategoryTag,
            },
          ],
          fixedNo: null,
          fixedChoiceIndex: null,
        });
      }
    }
  }

  // 孤立固定行: sourceConditionId = null で末尾に追加
  for (const row of orphanedFixed) {
    slots.push({
      id: createCreatePdfId('draw-slot'),
      subject: '',
      sourceConditionId: null,
      conditions: [],
      fixedNo: row.selectedNo,
      fixedChoiceIndex: normalizeQaaChoiceIndex(row.qaaChoiceIndex),
    });
  }

  return slots;
};

/**
 * Exam: 条件テーブル + 固定行 → DrawSlot[]
 * 各 ExamCategoryTableRow を 1 スロットとして変換する。
 * categoryConditions が空のスロットは「その学科全体」として扱われ、
 * runDrawEngine 内で MRV 末尾に配置される。
 */
export const buildExamDrawSlots = (
  categoryTable: readonly ExamCategoryTableRow[],
  fixedRows: readonly TestTableRow[],
  // grade は将来の枠バリデーション拡張用（現時点では参照のみ）
  _grade: 1 | 2,
): DrawSlot[] => {
  const conditionIdSet = new Set(categoryTable.map((c) => c.id));

  // Exam は 1 枠に 1 固定行のみ許容
  const fixedByConditionId = new Map<string, TestTableRow>();
  const orphanedFixed: TestTableRow[] = [];

  for (const row of fixedRows) {
    if (!row.isFixed || row.selectedNo === null) continue;
    if (
      row.sourceConditionId === null ||
      !conditionIdSet.has(row.sourceConditionId)
    ) {
      orphanedFixed.push(row);
    } else {
      fixedByConditionId.set(row.sourceConditionId, row);
    }
  }

  const slots: DrawSlot[] = [];

  for (const row of categoryTable) {
    const fixedRow = fixedByConditionId.get(row.id);
    slots.push({
      id: createCreatePdfId('draw-slot'),
      subject: row.subject,
      sourceConditionId: row.id,
      conditions: row.categoryConditions,
      fixedNo: fixedRow?.selectedNo ?? null,
      fixedChoiceIndex: null, // Exam は qaa 非対応のため常に null
    });
  }

  // 孤立固定行: sourceConditionId = null で末尾に追加
  for (const row of orphanedFixed) {
    slots.push({
      id: createCreatePdfId('draw-slot'),
      subject: '',
      sourceConditionId: null,
      conditions: [],
      fixedNo: row.selectedNo,
      fixedChoiceIndex: null, // Exam は常に null
    });
  }

  return slots;
};

/**
 * MRV + 重複排除による共通抽選エンジン。
 * 処理順: 固定スロット（2パス） → 非固定の非空枠を MRV 昇順 → 空枠を MRV 昇順。
 * MRV タイブレークはランダム（shuffleArray 後に安定ソート）。
 * isCalculated が true かつ entityCount に1件以上の指定がある場合は、
 * 非固定スロット全体の候補割当を先に解き、難易度別件数を厳守する。
 */
export const runDrawEngine = (params: {
  slots: readonly DrawSlot[];
  index: CandidateIndex;
  difficulty: CreatePdfDifficultyDraftState;
}): DrawResult => {
  const { slots, index, difficulty } = params;

  const selectedKeys = new Set<string>();
  const fixedUsedKeys = new Set<string>();
  const rowBySlotId = new Map<string, TestTableRow>();
  const errorRows: { slotId: string; message: string }[] = [];
  let hasError = false;

  // isCalculated かつ entityCount に1件以上の指定がある場合のみ難易度フィルタを有効にする
  const useDifficultyFilter =
    difficulty.isCalculated && difficulty.entityCount.some((c) => c > 0);
  // 各難易度 [★, ★★, ★★★] の残選出数。null のときはフィルタ無効
  const difficultyRemaining: [number, number, number] | null =
    useDifficultyFilter
      ? [
          difficulty.entityCount[0],
          difficulty.entityCount[1],
          difficulty.entityCount[2],
        ]
      : null;

  if (difficulty.isCalculated) {
    console.debug('[createPdf:draw] start', {
      slotCount: slots.length,
      difficulty: {
        isCalculated: difficulty.isCalculated,
        ratios: difficulty.ratios,
        entityCount: difficulty.entityCount,
        useDifficultyFilter,
      },
      slots: slots.map(summarizeSlot),
    });
  }

  /** 各スロットに対応する空の TestTableRow を生成する */
  const makeRow = (slot: DrawSlot): TestTableRow => {
    const categoryTable = slot.conditions.map((cond) => ({
      id: createCreatePdfId('test-category-condition'),
      subject: slot.subject || null,
      bigCategoryTag: cond.big,
      smallCategoryTag: cond.small,
    }));
    const row = createEmptyTestTableRow(
      categoryTable.length > 0 ? categoryTable : undefined,
    );
    row.sourceConditionId = slot.sourceConditionId;
    return row;
  };

  // パス1: fixedChoiceIndex 非 null の固定スロットを確定（No + choiceIndex 両方固定）
  for (const slot of slots) {
    if (slot.fixedNo === null || slot.fixedChoiceIndex === null) continue;
    const row = makeRow(slot);
    row.selectedNo = slot.fixedNo;
    row.qaaChoiceIndex = slot.fixedChoiceIndex;
    row.isFixed = true;
    fixedUsedKeys.add(
      toCandidateKey(Number(slot.fixedNo), slot.fixedChoiceIndex),
    );
    // 固定行の難易度消費を difficultyRemaining から差し引く
    if (difficultyRemaining !== null) {
      const td = index.allByNo.get(Number(slot.fixedNo));
      if (td !== undefined) {
        const diffIdx = Number(td.difficult) - 1;
        if (diffIdx >= 0 && diffIdx <= 2) difficultyRemaining[diffIdx]--;
      }
    }
    rowBySlotId.set(slot.id, row);
  }

  // パス2: fixedNo 非 null かつ fixedChoiceIndex が null の固定スロット（No のみ固定、choiceIndex は再抽選）
  for (const slot of slots) {
    if (slot.fixedNo === null || slot.fixedChoiceIndex !== null) continue;
    const row = makeRow(slot);
    row.selectedNo = slot.fixedNo;
    row.isFixed = true;
    const candidates = index.fixedEntriesByNo.get(Number(slot.fixedNo)) ?? [];

    if (candidates.length === 0) {
      row.hasError = true;
      row.errorMessage = '指定問題の有効選択肢がありません';
      errorRows.push({ slotId: slot.id, message: row.errorMessage });
      hasError = true;
    } else {
      const entry = shuffleArray(candidates)[0];
      if (entry !== undefined) {
        row.qaaChoiceIndex = entry.choiceIndex;
        fixedUsedKeys.add(toCandidateKey(entry.no, entry.choiceIndex));
      }
    }
    // 固定行の難易度消費を difficultyRemaining から差し引く
    if (difficultyRemaining !== null) {
      const td = index.allByNo.get(Number(slot.fixedNo));
      if (td !== undefined) {
        const diffIdx = Number(td.difficult) - 1;
        if (diffIdx >= 0 && diffIdx <= 2) difficultyRemaining[diffIdx]--;
      }
    }
    rowBySlotId.set(slot.id, row);
  }

  if (difficultyRemaining !== null) {
    console.debug('[createPdf:draw] after fixed slots', {
      initialEntityCount: difficulty.entityCount,
      remainingCounts: difficultyRemaining,
      fixedSlotCount: slots.filter((slot) => slot.fixedNo !== null).length,
      nonFixedSlotCount: slots.filter((slot) => slot.fixedNo === null).length,
    });
  }

  // 非固定スロットを MRV 順にソート（2パス完了後の selectedKeys で候補数計算）
  const getAvailableCount = (slot: DrawSlot): number =>
    resolveCandidates(index, slot.subject, slot.conditions).filter(
      (e) =>
        !selectedKeys.has(toCandidateKey(e.no, e.choiceIndex)) &&
        !fixedUsedKeys.has(toCandidateKey(e.no, e.choiceIndex)),
    ).length;

  const nonFixed = slots.filter((s) => s.fixedNo === null);
  const nonEmpty = nonFixed.filter((s) => s.conditions.length > 0);
  const empty = nonFixed.filter((s) => s.conditions.length === 0);

  const sortedNonEmpty = shuffleArray(nonEmpty).sort(
    (a, b) => getAvailableCount(a) - getAvailableCount(b),
  );
  const sortedEmpty = shuffleArray(empty).sort(
    (a, b) => getAvailableCount(a) - getAvailableCount(b),
  );

  const sortedNonFixed = [...sortedNonEmpty, ...sortedEmpty];
  const difficultyAssignment =
    difficultyRemaining !== null
      ? findDifficultyAssignment({
          slots: sortedNonFixed,
          candidateIndex: index,
          usedCandidateKeys: fixedUsedKeys,
          remainingCounts: difficultyRemaining,
        })
      : null;

  if (difficultyAssignment !== null && !difficultyAssignment.ok) {
    console.warn(
      '[createPdf:draw] difficulty assignment failed summary',
      JSON.stringify(
        {
          ratios: difficulty.ratios,
          entityCount: difficulty.entityCount,
          remainingCounts: difficultyRemaining,
          fixedSlotCount: slots.filter((slot) => slot.fixedNo !== null).length,
          nonFixedSlotCount: sortedNonFixed.length,
          sampleSlots: sortedNonFixed.slice(0, 12).map((slot) => ({
            ...summarizeSlot(slot),
            availableCount: getAvailableCount(slot),
          })),
        },
        null,
        2,
      ),
    );

    for (const slot of sortedNonFixed) {
      const row = makeRow(slot);
      const condLabel =
        slot.conditions.length === 0
          ? '（全問題）'
          : slot.conditions
              .map((c) => `${c.big}${c.small ? `/${c.small}` : ''}`)
              .join(' OR ');
      const message = `候補不足: ${slot.subject || '不明'} / ${condLabel}`;
      row.hasError = true;
      row.errorMessage = message;
      errorRows.push({ slotId: slot.id, message });
      hasError = true;
      rowBySlotId.set(slot.id, row);
    }

    const resultRows = slots
      .map((s) => rowBySlotId.get(s.id))
      .filter((r): r is TestTableRow => r !== undefined);
    return { rows: resultRows, hasError, errorRows };
  }

  // 非固定スロットを順番に処理
  for (const slot of sortedNonFixed) {
    const row = makeRow(slot);

    if (difficultyAssignment?.ok) {
      const entry = difficultyAssignment.assignments.get(slot.id);
      if (entry === undefined) {
        const message = `候補不足: ${slot.subject || '不明'}`;
        row.hasError = true;
        row.errorMessage = message;
        errorRows.push({ slotId: slot.id, message });
        hasError = true;
        rowBySlotId.set(slot.id, row);
        continue;
      }

      selectedKeys.add(toCandidateKey(entry.no, entry.choiceIndex));
      row.selectedNo = String(entry.no);
      row.qaaChoiceIndex = entry.choiceIndex;
      rowBySlotId.set(slot.id, row);
      continue;
    }

    const rawCandidates = resolveCandidates(
      index,
      slot.subject,
      slot.conditions,
    );
    const available = rawCandidates.filter(
      (e) =>
        !selectedKeys.has(toCandidateKey(e.no, e.choiceIndex)) &&
        !fixedUsedKeys.has(toCandidateKey(e.no, e.choiceIndex)),
    );

    if (available.length === 0) {
      const condLabel =
        slot.conditions.length === 0
          ? '（全問題）'
          : slot.conditions
              .map((c) => `${c.big}${c.small ? `/${c.small}` : ''}`)
              .join(' OR ');
      const message = `候補不足: ${slot.subject || '不明'} / ${condLabel}`;
      row.hasError = true;
      row.errorMessage = message;
      errorRows.push({ slotId: slot.id, message });
      hasError = true;
      rowBySlotId.set(slot.id, row);
      continue;
    }

    const entry = shuffleArray(available)[0];
    if (entry === undefined) continue; // 型ガード（到達しない）

    // 難易度残数を1減らす
    if (difficultyRemaining !== null) {
      const td = index.allByNo.get(entry.no);
      if (td !== undefined) {
        const diffIdx = Number(td.difficult) - 1;
        if (diffIdx >= 0 && diffIdx <= 2) {
          difficultyRemaining[diffIdx]--;
        }
      }
    }

    selectedKeys.add(toCandidateKey(entry.no, entry.choiceIndex));
    row.selectedNo = String(entry.no);
    row.qaaChoiceIndex = entry.choiceIndex;
    rowBySlotId.set(slot.id, row);
  }

  //  slotsの順序でrowsを組み直す
  const resultRows = slots
    .map((s) => rowBySlotId.get(s.id))
    .filter((r): r is TestTableRow => r !== undefined);

  // isCalculated が true の場合、固定行を含む全行の難易度別実績を entityCount と照合する
  if (difficulty.isCalculated) {
    const actualCounts: [number, number, number] = [0, 0, 0];
    for (const row of resultRows) {
      if (row.selectedNo === null) continue; // エラー行はスキップ
      const td = index.allByNo.get(Number(row.selectedNo));
      if (td === undefined) continue;
      const diffIdx = Number(td.difficult) - 1;
      if (diffIdx >= 0 && diffIdx <= 2) {
        actualCounts[diffIdx]++;
      }
    }
    const [e0, e1, e2] = difficulty.entityCount;
    const [a0, a1, a2] = actualCounts;
    if (e0 !== a0 || e1 !== a1 || e2 !== a2) {
      console.error(
        '[runDrawEngine] 難易度別選出数が entityCount と一致しません',
        { expected: difficulty.entityCount, actual: actualCounts },
      );
    }
  }

  return { rows: resultRows, hasError, errorRows };
};

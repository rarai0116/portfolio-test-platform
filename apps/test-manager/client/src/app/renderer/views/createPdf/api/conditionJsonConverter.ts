import { normalizeExamDateOption } from '@renderer/api/examDateOption';
import type { TestData, TestSubject } from '@shared/types/contracts';
import type {
  ConditionJsonCategoryPair,
  CreatePdfConditionJson,
  ExamConditionJson,
  ExamSlotRow,
  SelectedReference,
  WorkbookConditionJson,
  WorkbookConditionRow,
  WorkbookTableRow,
} from '@shared/types/createPdfConditionJson';
import { createInitialCreatePdfViewState } from '@views/createPdf/store/useCreatePdfViewStore';
import type {
  ExamState,
  WorkbookState,
} from '@views/createPdf/types/draftState';
import { DEFAULT_TEST_TABLE_SECTION_SUBJECT } from '@views/createPdf/types/testTable';
import type {
  TestCategoryCondition,
  TestTableRow,
  TestTableSection,
  TestTableStoreSnapshot,
} from '@views/createPdf/types/testTable';
import type {
  CreatePdfRouteSnapshot,
  WorkbookMode,
} from '@views/createPdf/types/viewState';
import type { ExamCategoryTableRow } from '../types/draftState';
import { normalizeQaaChoiceIndex } from './candidateIndex';
import {
  buildSelectedReference,
  referenceMatches,
} from './conditionJsonReference';
import {
  createExamDrawConditionKey,
  createExamTableKey,
  createWorkbookDrawConditionKey,
} from './createPdfConditionKeys';
import { EXAM_SUBJECTS_BY_GRADE } from './examMockTable';
import { createWorkbookCategoryConditionId } from './workbookConditions';

export const shouldShowQaaChoiceIndexForWorkbookMode = (
  workbookMode: WorkbookMode,
): boolean => workbookMode !== 'multipleChoice';

export const resolveConditionJsonShowQaaChoiceIndex = (
  json: CreatePdfConditionJson,
): boolean => {
  if (typeof json.showQaaChoiceIndex === 'boolean') {
    return json.showQaaChoiceIndex;
  }

  if (json.creationType === 'workbook') {
    const modeDefault = json.mode !== 'multipleChoice';
    return json.showQaaChoiceIndex ?? modeDefault;
  }

  return false;
};

const TEST_SUBJECTS = [
  '学科Ⅰ',
  '学科Ⅱ',
  '学科Ⅲ',
  '学科Ⅳ',
  '学科Ⅴ',
] as const satisfies readonly TestSubject[];

const isTestSubject = (value: string | null | undefined): value is TestSubject =>
  TEST_SUBJECTS.includes(value as TestSubject);

const resolveWorkbookTableSubject = (
  conditions: readonly WorkbookConditionRow[],
): TestSubject => {
  const subjects = new Set<TestSubject>();
  for (const condition of conditions) {
    if (isTestSubject(condition.subject)) {
      subjects.add(condition.subject);
    }
  }

  if (subjects.size === 1) {
    return [...subjects][0] ?? DEFAULT_TEST_TABLE_SECTION_SUBJECT;
  }
  return DEFAULT_TEST_TABLE_SECTION_SUBJECT;
};

type NormalizedWorkbookRestoreJson = Pick<
  WorkbookConditionJson,
  'conditions' | 'table'
> & {
  migratedConditionIdMap: Map<string, string>;
};

export const normalizeWorkbookConditionJsonForRestore = (
  json: WorkbookConditionJson,
): NormalizedWorkbookRestoreJson => {
  const conditionsByStableId = new Map<string, WorkbookConditionRow>();
  const migratedConditionIdMap = new Map<string, string>();

  for (const condition of json.conditions) {
    if (condition.subject === null || condition.bigCategoryTag === null) {
      continue;
    }

    const stableId = createWorkbookCategoryConditionId({
      subject: condition.subject,
      bigCategoryTag: condition.bigCategoryTag,
      smallCategoryTag: condition.smallCategoryTag,
    });
    migratedConditionIdMap.set(condition.id, stableId);

    const existing = conditionsByStableId.get(stableId);
    if (existing) {
      conditionsByStableId.set(stableId, {
        ...existing,
        count: existing.count + condition.count,
      });
      continue;
    }

    conditionsByStableId.set(stableId, {
      ...condition,
      id: stableId,
    });
  }

  const table = json.table.map((row) => ({
    ...row,
    sourceConditionId:
      row.sourceConditionId === null
        ? null
        : (migratedConditionIdMap.get(row.sourceConditionId) ??
          row.sourceConditionId),
  }));

  return {
    conditions: Array.from(conditionsByStableId.values()),
    table,
    migratedConditionIdMap,
  };
};

/**
 * 問題集作成モードの出題条件JSONを構築する。
 * selectedNo から testDataByNo を引いて selectedUuid / selectedReference を解決する。
 *
 * @param workbookDraft  useWorkbookDraftStore の現在の状態
 * @param testTableState useTestTableStore の現在の状態
 * @param testDataByNo   useCreatePdfResourceStore から取得した no → TestData Map
 */
export const buildWorkbookConditionJson = (
  workbookDraft: WorkbookState,
  testTableState: TestTableStoreSnapshot,
  testDataByNo: ReadonlyMap<number, TestData>,
): WorkbookConditionJson => {
  const { basic, stepTwo, stepThree } = workbookDraft;
  const rows = testTableState.sections[0]?.rows ?? [];

  const conditions: WorkbookConditionRow[] = stepTwo.categoryTable.map(
    (row) => ({
      id: row.id,
      subject: row.subject,
      bigCategoryTag: row.bigCategoryTag,
      smallCategoryTag: row.smallCategoryTag,
      count: row.count,
    }),
  );

  const table: WorkbookTableRow[] = rows.map((row) => {
    const categoryPairs: ConditionJsonCategoryPair[] = row.categoryTable.map(
      (c) => ({
        big: c.bigCategoryTag,
        small: c.smallCategoryTag,
      }),
    );

    if (row.selectedNo === null) {
      return {
        id: row.id,
        sourceConditionId: row.sourceConditionId,
        categoryPairs,
        selectedNo: null,
        selectedUuid: null,
        selectedReference: null,
        qaaChoiceIndex: normalizeQaaChoiceIndex(row.qaaChoiceIndex),
        isFixed: row.isFixed,
        pageBreakBefore: row.pageBreakBefore,
      };
    }

    const no = Number(row.selectedNo);
    const testData = testDataByNo.get(no);
    const selectedUuid = testData?.uuid ?? null;
    const selectedReference = testData
      ? buildSelectedReference(testData)
      : null;

    return {
      id: row.id,
      sourceConditionId: row.sourceConditionId,
      categoryPairs,
      selectedNo: row.selectedNo,
      selectedUuid,
      selectedReference,
      qaaChoiceIndex: normalizeQaaChoiceIndex(row.qaaChoiceIndex),
      isFixed: row.isFixed,
      pageBreakBefore: row.pageBreakBefore,
    };
  });

  return {
    version: 1,
    creationType: 'workbook',
    gradeId: basic.grade,
    title: basic.title,
    createdAt: new Date().toISOString(),
    shuffleSeed: stepTwo.options.shuffleSeed,
    mode: stepTwo.workbookMode,
    excludedTagIds: stepTwo.options.excludedTagIds,
    excludePastExam: stepTwo.options.excludePastExam,
    excludeOriginal: stepTwo.options.excludeOriginal,
    isChoiceShuffle: stepTwo.options.isShuffleChoices,
    difficulty: {
      // isCalculated が true の場合のみ難易度設定が有効
      isEnabled: stepTwo.difficulty.isCalculated,
      ratios: stepTwo.difficulty.ratios,
    },
    selectedOutputFolder: stepThree.selectedOutputFolder,
    selectedYears: basic.selectedYears,
    showQaaChoiceIndex: testTableState.settings.showQaaChoiceIndex,
    conditions,
    table,
  };
};

// ─── T27: resolveConditionJsonToSnapshot ─────────────────────────────────────

/** JSON 読込後に表示する「自動調整行」の情報。 */
export type AdjustedRowInfo = {
  rowId: string;
  originalNo: string | null;
  resolvedNo: string | null;
  reason: 'uuid_changed' | 'reference_changed' | 'cleared';
};

export type ResolveConditionJsonResult = {
  snapshot: CreatePdfRouteSnapshot;
  adjustedRows: AdjustedRowInfo[];
};

// ─── 内部ヘルパー ──────────────────────────────────────────────────────────────

function uuidMatches(storedUuid: string | null, testData: TestData): boolean {
  return storedUuid === (testData.uuid ?? null);
}

function categoryPairsMatch(
  pairs: ConditionJsonCategoryPair[],
  testData: TestData,
): boolean {
  if (pairs.length === 0) return true; // 条件なし = 常に適合
  return pairs.some(
    (pair) =>
      (pair.big === null || pair.big === testData.bigCategoryTag) &&
      (pair.small === null || pair.small === testData.smallCategoryTag),
  );
}

function toCategoryConditions(
  rowId: string,
  pairs: ConditionJsonCategoryPair[],
): TestCategoryCondition[] {
  return pairs.map((pair, i) => ({
    id: `${rowId}_cat_${i}`,
    subject: null,
    bigCategoryTag: pair.big,
    smallCategoryTag: pair.small,
  }));
}

type RowResolution = {
  resolvedNo: string | null;
  adjustedRow: AdjustedRowInfo | null;
};

function resolveTableRow(params: {
  rowId: string;
  originalNo: string | null;
  storedUuid: string | null;
  storedRef: SelectedReference | null;
  isFixed: boolean;
  categoryPairs: ConditionJsonCategoryPair[];
  testDataByNo: ReadonlyMap<number, TestData>;
  testDataByUuid: ReadonlyMap<string, TestData>;
}): RowResolution {
  const {
    rowId,
    originalNo,
    storedUuid,
    storedRef,
    isFixed,
    categoryPairs,
    testDataByNo,
    testDataByUuid,
  } = params;

  if (originalNo === null) return { resolvedNo: null, adjustedRow: null };

  const no = Number(originalNo);
  const byNo = testDataByNo.get(no);

  if (byNo !== undefined) {
    const uuidMatch = uuidMatches(storedUuid, byNo);
    const refMatch = referenceMatches(storedRef, byNo);

    if (uuidMatch && refMatch) {
      return { resolvedNo: originalNo, adjustedRow: null };
    }

    if (!uuidMatch && refMatch && !isFixed) {
      return {
        resolvedNo: originalNo,
        adjustedRow: {
          rowId,
          originalNo,
          resolvedNo: originalNo,
          reason: 'uuid_changed',
        },
      };
    }

    if (!uuidMatch && refMatch && isFixed) {
      if (storedUuid !== null) {
        const byUuid = testDataByUuid.get(storedUuid);
        if (byUuid !== undefined) {
          const resolvedNo = String(byUuid.no);
          return {
            resolvedNo,
            adjustedRow:
              resolvedNo !== originalNo
                ? { rowId, originalNo, resolvedNo, reason: 'reference_changed' }
                : null,
          };
        }
      }
      return {
        resolvedNo: null,
        adjustedRow: { rowId, originalNo, resolvedNo: null, reason: 'cleared' },
      };
    }

    if (uuidMatch && !refMatch && isFixed) {
      return {
        resolvedNo: originalNo,
        adjustedRow: {
          rowId,
          originalNo,
          resolvedNo: originalNo,
          reason: 'reference_changed',
        },
      };
    }

    if (uuidMatch && !refMatch && !isFixed) {
      if (categoryPairsMatch(categoryPairs, byNo)) {
        return { resolvedNo: originalNo, adjustedRow: null };
      }
      return {
        resolvedNo: null,
        adjustedRow: { rowId, originalNo, resolvedNo: null, reason: 'cleared' },
      };
    }
  }

  // no が存在しない、または !uuidMatch && !refMatch → UUID で再検索
  if (storedUuid !== null) {
    const byUuid = testDataByUuid.get(storedUuid);
    if (byUuid !== undefined) {
      const resolvedNo = String(byUuid.no);
      return {
        resolvedNo,
        adjustedRow:
          resolvedNo !== originalNo
            ? { rowId, originalNo, resolvedNo, reason: 'reference_changed' }
            : null,
      };
    }
  }

  return {
    resolvedNo: null,
    adjustedRow: { rowId, originalNo, resolvedNo: null, reason: 'cleared' },
  };
}

// ─── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * JSON から CreatePdfRouteSnapshot を復元する。
 * 各問題行の UUID/参照照合を行い、調整が発生した行を adjustedRows に集める。
 */
export const resolveConditionJsonToSnapshot = (
  json: CreatePdfConditionJson,
  testDataByNo: ReadonlyMap<number, TestData>,
  testDataByUuid: ReadonlyMap<string, TestData>,
): ResolveConditionJsonResult => {
  const adjustedRows: AdjustedRowInfo[] = [];
  const common = {
    ...createInitialCreatePdfViewState(json.creationType),
    grade: json.gradeId,
    title: json.title,
  };

  if (json.creationType === 'workbook') {
    const normalizedJson = normalizeWorkbookConditionJsonForRestore(json);
    const tableRows: TestTableRow[] = normalizedJson.table.map((row) => {
      const result = resolveTableRow({
        rowId: row.id,
        originalNo: row.selectedNo,
        storedUuid: row.selectedUuid,
        storedRef: row.selectedReference,
        isFixed: row.isFixed,
        categoryPairs: row.categoryPairs,
        testDataByNo,
        testDataByUuid,
      });
      if (result.adjustedRow) adjustedRows.push(result.adjustedRow);
      return {
        id: row.id,
        sourceConditionId: row.sourceConditionId,
        categoryTable: toCategoryConditions(row.id, row.categoryPairs),
        selectedNo: result.resolvedNo,
        qaaChoiceIndex: normalizeQaaChoiceIndex(row.qaaChoiceIndex),
        isFixed: row.isFixed,
        pageBreakBefore: row.pageBreakBefore,
        hasError: false,
        errorMessage: null,
      };
    });

    const workbook: WorkbookState = {
      basic: {
        grade: json.gradeId,
        title: json.title,
        selectedYears: json.selectedYears ?? null,
      },
      stepTwo: {
        workbookMode: json.mode,
        options: {
          excludedTagIds: json.excludedTagIds,
          excludePastExam: json.excludePastExam,
          excludeOriginal: json.excludeOriginal,
          isShuffleChoices: json.isChoiceShuffle,
          shuffleSeed: json.shuffleSeed,
        },
        difficulty: {
          isCalculated: json.difficulty.isEnabled,
          ratios: json.difficulty.ratios,
          entityCount: [0, 0, 0],
          settableDifficultyRanges: null,
        },
        categoryTable: normalizedJson.conditions.map((cond) => ({
          id: cond.id,
          subject: cond.subject,
          bigCategoryTag: cond.bigCategoryTag,
          smallCategoryTag: cond.smallCategoryTag,
          count: cond.count,
        })),
      },
      stepThree: {
        selectedOutputFolder: json.selectedOutputFolder ?? null,
        includeCover: true,
        excludeMiddleCover: true,
        saveConditionJson: true,
        examDate: normalizeExamDateOption(undefined),
      },
    };

    const lastAppliedDrawConditionKey = createWorkbookDrawConditionKey({
      basic: workbook.basic,
      stepTwo: workbook.stepTwo,
    });
    const workbookTableSubject = resolveWorkbookTableSubject(
      normalizedJson.conditions,
    );
    const workbookSections: TestTableSection[] = [
      {
        id: '1',
        label: '問題',
        subject: workbookTableSubject,
        rows: tableRows,
      },
    ];

    const testTable: TestTableStoreSnapshot = {
      sections: workbookSections,
      sectionMode: 'single',
      settings: {
        showQaaChoiceIndex: resolveConditionJsonShowQaaChoiceIndex(json),
      },
      lastAppliedDrawConditionKey,
      lastSavedOrRestoredTableKey: JSON.stringify(workbookSections),
    };

    return { snapshot: { common, workbook, testTable }, adjustedRows };
  }

  // exam
  const subjectMap = new Map<string, ExamSlotRow[]>();
  for (const slot of json.slots) {
    const list = subjectMap.get(slot.subject) ?? [];
    list.push(slot);
    subjectMap.set(slot.subject, list);
  }

  const correctSubjectsForGrade: readonly string[] =
    EXAM_SUBJECTS_BY_GRADE[json.gradeId as 1 | 2] ?? [];
  const uniqueOldSubjects = [...subjectMap.keys()];
  const resolveSubject = (s: string): string => {
    if (correctSubjectsForGrade.includes(s)) return s; // 新フォーマットはそのまま
    const pos = uniqueOldSubjects.indexOf(s); // 旧フォーマット: 位置で対応付け
    return correctSubjectsForGrade[pos] ?? s;
  };

  const examSections: TestTableSection[] = [];
  for (const [subject, slots] of subjectMap) {
    const resolvedSubject = resolveSubject(subject);
    const rows: TestTableRow[] = slots.map((slot) => {
      const sourceConditionId = `restored_${slot.id}`;
      const result = resolveTableRow({
        rowId: slot.id,
        originalNo: slot.selectedNo,
        storedUuid: slot.selectedUuid,
        storedRef: slot.selectedReference,
        isFixed: slot.isFixed,
        categoryPairs: slot.categoryPairs,
        testDataByNo,
        testDataByUuid,
      });
      if (result.adjustedRow) adjustedRows.push(result.adjustedRow);
      return {
        id: slot.id,
        sourceConditionId,
        categoryTable: toCategoryConditions(slot.id, slot.categoryPairs),
        selectedNo: result.resolvedNo,
        qaaChoiceIndex: null, // ExamSlotRow に qaaChoiceIndex はない
        isFixed: slot.isFixed,
        pageBreakBefore: slot.pageBreakBefore,
        hasError: false,
        errorMessage: null,
      };
    });
    examSections.push({
      id: resolvedSubject,
      label: resolvedSubject,
      subject: isTestSubject(resolvedSubject)
        ? resolvedSubject
        : DEFAULT_TEST_TABLE_SECTION_SUBJECT,
      rows,
    });
  }

  const categoryTable: ExamCategoryTableRow[] = json.slots.map((slot) => ({
    id: `restored_${slot.id}`,
    subject: resolveSubject(slot.subject) as TestSubject,
    categoryConditions: slot.categoryPairs
      .filter(
        (pair): pair is { big: string; small: string | null } =>
          pair.big !== null,
      )
      .map((pair) => ({ big: pair.big, small: pair.small })),
  }));
  const exam: ExamState = {
    basic: {
      grade: json.gradeId,
      title: json.title,
      selectedYears: json.selectedYears ?? null,
    },
    stepTwo: {
      options: {
        excludedTagIds: json.excludedTagIds,
        excludePastExam: json.excludePastExam,
        excludeOriginal: json.excludeOriginal,
        isShuffleChoices: json.isChoiceShuffle,
        shuffleSeed: json.shuffleSeed,
      },
      difficulty: {
        isCalculated: json.difficulty.isEnabled,
        ratios: json.difficulty.ratios,
        entityCount: [0, 0, 0],
        settableDifficultyRanges: null,
      },
      categoryTable: categoryTable,
    },
    stepThree: {
      selectedOutputFolder: json.selectedOutputFolder ?? null,
      includeCover: true,
      excludeMiddleCover: true,
      saveConditionJson: true,
      examDate: normalizeExamDateOption(json.examDate),
    },
  };

  const lastAppliedDrawConditionKey = createExamDrawConditionKey({
    basic: exam.basic,
    stepTwo: exam.stepTwo,
  });

  const testTable: TestTableStoreSnapshot = {
    sections: examSections,
    sectionMode: 'by-subject',
    settings: {
      showQaaChoiceIndex: resolveConditionJsonShowQaaChoiceIndex(json),
    },
    lastAppliedDrawConditionKey,
    lastSavedOrRestoredTableKey: createExamTableKey(examSections),
  };

  return { snapshot: { common, exam, testTable }, adjustedRows };
};

// ─── T39: buildExamConditionJson ──────────────────────────────────────────────

/**
 * 模擬試験モードの出題条件JSONを構築する。
 * testTableState.sections を学科 = section として平坦化する。
 *
 * @param examDraft      useExamDraftStore の現在の状態
 * @param testTableState useTestTableStore の現在の状態
 * @param testDataByNo   useCreatePdfResourceStore から取得した no → TestData Map
 */
export const buildExamConditionJson = (
  examDraft: ExamState,
  testTableState: TestTableStoreSnapshot,
  testDataByNo: ReadonlyMap<number, TestData>,
): ExamConditionJson => {
  const { basic, stepTwo, stepThree } = examDraft;

  const slots: ExamSlotRow[] = testTableState.sections.flatMap((section) =>
    section.rows.map((row): ExamSlotRow => {
      const sectionSubject =
        section.subject !== undefined && section.subject !== 'all'
          ? section.subject
          : section.label;
      const categoryPairs: ConditionJsonCategoryPair[] = row.categoryTable.map(
        (c) => ({ big: c.bigCategoryTag, small: c.smallCategoryTag }),
      );

      if (row.selectedNo === null) {
        return {
          id: row.id,
          subject: sectionSubject,
          categoryPairs,
          isFixed: row.isFixed,
          pageBreakBefore: row.pageBreakBefore,
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
        };
      }

      const no = Number(row.selectedNo);
      const testData = testDataByNo.get(no);
      const selectedUuid = testData?.uuid ?? null;
      const selectedReference = testData
        ? buildSelectedReference(testData)
        : null;

      return {
        id: row.id,
        subject: sectionSubject,
        categoryPairs,
        isFixed: row.isFixed,
        pageBreakBefore: row.pageBreakBefore,
        selectedNo: row.selectedNo,
        selectedUuid,
        selectedReference,
      };
    }),
  );

  return {
    version: 1,
    creationType: 'exam',
    gradeId: basic.grade,
    title: basic.title,
    createdAt: new Date().toISOString(),
    shuffleSeed: stepTwo.options.shuffleSeed,
    excludedTagIds: stepTwo.options.excludedTagIds,
    excludePastExam: stepTwo.options.excludePastExam,
    excludeOriginal: stepTwo.options.excludeOriginal,
    isChoiceShuffle: stepTwo.options.isShuffleChoices,
    difficulty: {
      isEnabled: stepTwo.difficulty.isCalculated,
      ratios: stepTwo.difficulty.ratios,
    },
    selectedOutputFolder: stepThree.selectedOutputFolder,
    selectedYears: basic.selectedYears,
    showQaaChoiceIndex: testTableState.settings.showQaaChoiceIndex,
    examDate: normalizeExamDateOption(stepThree.examDate),
    slots,
  };
};

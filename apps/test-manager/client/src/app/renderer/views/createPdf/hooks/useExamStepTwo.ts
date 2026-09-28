import { generateShuffleSeed } from '@api/shuffleSeed';
import type { TestSubject } from '@shared/types/contracts';
import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import type { CandidateIndex } from '@views/createPdf/api/candidateIndex';
import {
  buildCategoryTreeBySubject,
  type CategoryTreeBySubject,
} from '@views/createPdf/api/categoryUtils';
import { createCreatePdfId } from '@views/createPdf/api/common';
import {
  //  deriveActiveConditionIds,
  deriveCreatePdfCandidateIndex,
  //  deriveCreatePdfTestTableChecksCached,
  filterTestDataBySelectedYears,
} from '@views/createPdf/api/createPdfDerivedInputs';
import {
  createDifficultyFeasibilityTask,
  createFixedDrawSlotsSignature,
  type DifficultyFeasibilityTask,
} from '@views/createPdf/api/difficultyFeasibilityRunner';
// import { deriveCreatePdfDrawStatus } from '@views/createPdf/api/createPdfDrawStatus';
import {
  type AvailableDifficultyTestCounts,
  adjustDifficultyByFeasibility,
  calcCountsFromRatio,
  calcDifficultySliderDynamicBounds,
  calcNaturalRatios,
  collectAvailableTestCounts,
  createDifficultyCountKey,
  type DifficultyFeasibility,
  type DifficultySliderDynamicBounds,
  findNearestAssignablePattern,
  prepareBfsFeasibility,
} from '@views/createPdf/api/difficultyUtils';
import {
  buildExamDrawSlots,
  type DrawSlot,
} from '@views/createPdf/api/drawEngine';
import { runDrawWithValidation } from '@views/createPdf/api/drawWithValidation';
import {
  createDrawWithValidationWorkerTask,
  type DrawWithValidationWorkerTask,
  shouldRunDrawInWorker,
} from '@views/createPdf/api/drawWorkerClient';
import {
  buildMockExamSection,
  EXAM_REQUIRED_COUNTS_BY_GRADE,
  EXAM_SUBJECTS_BY_GRADE,
  getNextExamMockSubject,
} from '@views/createPdf/api/examMockTable';
import { reconnectExamTableRowsToCategoryRows } from '@views/createPdf/api/examTableRows';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import type {
  CategoryCondition,
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
  ExamCategoryTableRow,
} from '@views/createPdf/types/draftState';
import type {
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createExamDrawConditionKey } from '../api/createPdfConditionKeys';
/** categoryTable をUI向けに変換した行型 */
export type CategoryRowForUI = {
  id: string;
  subject: TestSubject;
  selectedCategories: string[];
};

type ExamCategoryNormalizationResult = {
  rows: ExamCategoryTableRow[];
  removedCount: number;
};

const getExamRequiredCount = (grade: 1 | 2, subject: TestSubject): number =>
  (EXAM_REQUIRED_COUNTS_BY_GRADE[grade] as Record<TestSubject, number>)[
    subject
  ] ?? 0;

const trimExamCategoryRowsToRequiredCounts = (
  grade: 1 | 2,
  rows: readonly ExamCategoryTableRow[],
): ExamCategoryNormalizationResult => {
  const subjects = new Set<TestSubject>(EXAM_SUBJECTS_BY_GRADE[grade]);
  const countsBySubject = new Map<TestSubject, number>();
  const normalizedRows: ExamCategoryTableRow[] = [];
  let removedCount = 0;

  for (const row of rows) {
    if (!subjects.has(row.subject)) {
      removedCount++;
      continue;
    }

    const currentCount = countsBySubject.get(row.subject) ?? 0;
    const requiredCount = getExamRequiredCount(grade, row.subject);
    if (currentCount >= requiredCount) {
      removedCount++;
      continue;
    }

    countsBySubject.set(row.subject, currentCount + 1);
    normalizedRows.push(row);
  }

  return { rows: normalizedRows, removedCount };
};

const countRowsBySubject = (
  rows: readonly ExamCategoryTableRow[],
): Partial<Record<TestSubject, number>> => {
  const counts: Partial<Record<TestSubject, number>> = {};
  for (const row of rows) {
    counts[row.subject] = (counts[row.subject] ?? 0) + 1;
  }
  return counts;
};

const createEmptyExamTestTableRow = (
  categoryRow: ExamCategoryTableRow,
): TestTableRow => ({
  id: createCreatePdfId('row'),
  sourceConditionId: categoryRow.id,
  categoryTable: [],
  selectedNo: null,
  qaaChoiceIndex: null,
  isFixed: false,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
});

const buildExamSectionsFromCategoryRows = (params: {
  grade: 1 | 2;
  categoryRows: readonly ExamCategoryTableRow[];
  currentSections: readonly TestTableSection[];
}): TestTableSection[] => {
  const { grade, categoryRows, currentSections } = params;
  const currentSectionsByLabel = new Map(
    currentSections.map((section) => [section.label, section]),
  );

  return EXAM_SUBJECTS_BY_GRADE[grade].flatMap((subject) => {
    const subjectCategoryRows = categoryRows.filter(
      (row) => row.subject === subject,
    );
    if (subjectCategoryRows.length === 0) return [];

    const currentSection = currentSectionsByLabel.get(subject);
    const currentRowsByConditionId = new Map(
      (currentSection?.rows ?? [])
        .filter((row) => row.sourceConditionId !== null)
        .map((row) => [row.sourceConditionId as string, row]),
    );

    return [
      {
        id: currentSection?.id ?? createCreatePdfId('section'),
        label: subject,
        subject,
        rows: subjectCategoryRows.map(
          (categoryRow) =>
            currentRowsByConditionId.get(categoryRow.id) ??
            createEmptyExamTestTableRow(categoryRow),
        ),
      },
    ];
  });
};

export type UseExamStepTwoOutput = {
  options: CreatePdfCommonOptionDraftState;
  difficulty: CreatePdfDifficultyDraftState;
  categoryTable: ExamCategoryTableRow[];
  isLoadingTestData: boolean;
  updateOptions: (patch: Partial<CreatePdfCommonOptionDraftState>) => void;
  updateDifficulty: (patch: Partial<CreatePdfDifficultyDraftState>) => void;
  // 難易度調整
  availableTestCounts: AvailableDifficultyTestCounts;
  totalCount: number;
  committedCounts: AvailableDifficultyTestCounts;
  difficultySliderDynamicBounds: DifficultySliderDynamicBounds | null;
  calculateDifficulty: () => Promise<void>;
  // resetDifficulty は外部公開しない（条件変更時に自動リセット）
  isCalculateDisabled: boolean;
  onRatioCommit: (ratio: [number, number]) => void;
  addCategoryTableRow: () => void;
  updateCategoryTableRow: (conditionId: string, selected: string[]) => void;
  removeCategoryTableRow: (conditionId: string) => void;
  /** 学科別大分類・小分類ツリー */
  categoryTreeBySubject: CategoryTreeBySubject;
  /** categoryTable から変換済みの行リスト */
  categoryTableForUI: CategoryRowForUI[];
  /**
   * demand >= supply に達したカテゴリの "big/small" キー集合（学科別）。
   * ExamCategory での per-row ドロップダウン除外に使用する。
   */
  exhaustedCategoryKeysBySubject: Record<TestSubject, ReadonlySet<string>>;
  // drawButtonDisabled: boolean;
  drawErrorMessage: string | null;
  clearDrawErrorMessage: () => void;
  initializeCategoryTableRows: () => void;
  executeDraw: () => Promise<void>;
  isBfsCalculating: boolean;
  /** 問題テーブル行の selectedNo / qaaChoiceIndex / isFixed / pageBreakBefore を更新 */
  updateTableRow: (
    sectionId: string,
    rowId: string,
    patch: Partial<
      Pick<
        TestTableRow,
        'selectedNo' | 'qaaChoiceIndex' | 'isFixed' | 'pageBreakBefore'
      >
    >,
  ) => void;
};

const EMPTY_FEASIBILITY: DifficultyFeasibility = {
  totalCount: 0,
  fixedCounts: [0, 0, 0],
  patterns: [],
  ranges: [
    { min: 0, max: 0 },
    { min: 0, max: 0 },
    { min: 0, max: 0 },
  ],
  assignableCountKeys: new Set(),
  rawPatternCount: 0,
  exactFilteringDurationMs: 0,
  isPatternAssignable: () => false,
};

/**
 * exam Step2 固有ロジックを扱う mode hook。
 * useExamDraftStore を直接操作し、panel model へ公開する。
 * categoryTable の詳細は T35/T36 で拡張する。
 */
const useExamStepTwo = (input: {
  selectedYearNos: ReadonlySet<number> | null;
}) => {
  const { selectedYearNos } = input;
  const [drawErrorMessage, setDrawErrorMessage] = useState<string | null>(null);
  const {
    grade,
    stepTwo,
    setOptions,
    setDifficulty,
    replaceCategoryTableRows,
  } = useExamDraftStore(
    useShallow((state) => ({
      grade: state.basic.grade,
      stepTwo: state.stepTwo,
      setOptions: state.actions.setOptions,
      setDifficulty: state.actions.setDifficulty,
      replaceCategoryTableRows: state.actions.replaceCategoryTableRows,
    })),
  );
  const { isLoadingTestData, testDataByNo } = useCreatePdfResourceStore(
    useShallow((state) => ({
      isLoadingTestData: state.testData.isLoading,
      testDataByNo: state.testData.maps.byNo,
    })),
  );
  const testTableSections = useTestTableStore((s) => s.sections);
  const applyDrawResult = useTestTableStore((s) => s.actions.applyDrawResult);
  const updateRowInStore = useTestTableStore((s) => s.actions.updateRow);

  const testCategory = useCreatePdfResourceStore((s) => s.testCategory);

  /** 年フィルタ適用済みの testDataByNo。selectedYearNos === null なら全件そのまま使用。 */
  const filteredTestDataByNo = useMemo(() => {
    return filterTestDataBySelectedYears(testDataByNo, selectedYearNos);
  }, [testDataByNo, selectedYearNos]);

  /** 候補インデックス: フィルタ関係フィールドのみ依存配列に指定してキャッシュ */
  // biome-ignore lint/correctness/useExhaustiveDependencies: isShuffleChoices / shuffleSeed は候補フィルタに無関係なため意図的に除外
  const candidateIndex = useMemo(
    () =>
      deriveCreatePdfCandidateIndex({
        filteredTestDataByNo,
        allTestDataByNo: testDataByNo,
        fixedTestDataByNo: testDataByNo,
        options: stepTwo.options,
      }),
    [
      filteredTestDataByNo,
      testDataByNo,
      stepTwo.options.excludedTagIds,
      stepTwo.options.excludePastExam,
      stepTwo.options.excludeOriginal,
    ],
  );

  /** CategoryCascadeSelect で使用する、学科ごとの大分類・小分類のツリー構造 */
  const categoryTreeBySubject = useMemo(
    () => buildCategoryTreeBySubject(testCategory),
    [testCategory],
  );
  /*
  const activeConditionIds = useMemo(
    () => deriveActiveConditionIds(stepTwo.categoryTable),
    [stepTwo.categoryTable],
  );

  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections: testTableSections,
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'by-subject',
        activeConditionIds,
      }),
    [testTableSections, testDataByNo, activeConditionIds],
  );

  const fixedRows = useMemo(
    () =>
      reconnectExamTableRowsToCategoryRows({
        categoryRows: stepTwo.categoryTable,
        sections: testTableSections,
      }).flatMap((section) =>
        section.rows.filter((row) => row.isFixed),
      ),
    [stepTwo.categoryTable, testTableSections],
  );
  const drawSlots = useMemo(
    () => buildExamDrawSlots(stepTwo.categoryTable, fixedRows, grade),
    [stepTwo.categoryTable, fixedRows, grade],
  );
  const conditionRequirements = useMemo(
    () => new Map(stepTwo.categoryTable.map((row) => [row.id, 1])),
    [stepTwo.categoryTable],
  );

  const drawStatus = useMemo(
    () =>
      deriveCreatePdfDrawStatus({
        hasCategoryConditions: stepTwo.categoryTable.length > 0,
        candidateIndex,
        testTableChecks,
        slots: drawSlots,
        fixedRows,
        conditionRequirements,
      }),
    [
      stepTwo.categoryTable.length,
      candidateIndex,
      testTableChecks,
      drawSlots,
      fixedRows,
      conditionRequirements,
    ],
  );
  */

  const fixedRows = useMemo(
    () =>
      reconnectExamTableRowsToCategoryRows({
        categoryRows: stepTwo.categoryTable,
        sections: testTableSections,
      }).flatMap((section) => section.rows.filter((row) => row.isFixed)),
    [stepTwo.categoryTable, testTableSections],
  );
  const drawSlots = useMemo(
    () => buildExamDrawSlots(stepTwo.categoryTable, fixedRows, grade),
    [stepTwo.categoryTable, fixedRows, grade],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 必要出題数を超えている場合のチェック 超えていた場合はトリミング
  useEffect(() => {
    if (stepTwo.categoryTable.length === 0) return;
    const normalized = trimExamCategoryRowsToRequiredCounts(
      grade,
      stepTwo.categoryTable,
    );
    if (normalized.removedCount === 0) return;

    const nextSections = buildExamSectionsFromCategoryRows({
      grade,
      categoryRows: normalized.rows,
      currentSections: reconnectExamTableRowsToCategoryRows({
        categoryRows: stepTwo.categoryTable,
        sections: testTableSections,
      }),
    });
    console.warn('[createPdf:exam] category rows normalized', {
      removedCount: normalized.removedCount,
      requiredCounts: EXAM_REQUIRED_COUNTS_BY_GRADE[grade],
      beforeCounts: countRowsBySubject(stepTwo.categoryTable),
      afterCounts: countRowsBySubject(normalized.rows),
      sectionRowCounts: Object.fromEntries(
        nextSections.map((section) => [section.label, section.rows.length]),
      ),
    });
    replaceCategoryTableRows(normalized.rows);

    const { basic, stepTwo: s, stepThree } = useExamDraftStore.getState();
    const drawConditionKey = createExamDrawConditionKey({
      basic,
      stepTwo: { ...s, categoryTable: normalized.rows },
      stepThree,
    });
    applyDrawResult({ sections: nextSections, drawConditionKey });
  }, [grade, stepTwo.categoryTable, testTableSections]);

  /**
   * demand >= supply に達したカテゴリを学科別に収録した Set。
   * OR 条件の各候補を +1 する保守的カウント（偽陽性を許容）。
   * stepTwo.categoryTable または testDataByNo が変化するたびに再計算される。
   */
  const exhaustedCategoryKeysBySubject = useMemo((): Record<
    TestSubject,
    ReadonlySet<string>
  > => {
    // demand: key "subject::big::small" → { subject, big, small, count }
    const demandMap = new Map<
      string,
      { subject: TestSubject; big: string; small: string; count: number }
    >();
    for (const row of stepTwo.categoryTable) {
      for (const cond of row.categoryConditions) {
        const key = `${row.subject}::${cond.big}::${cond.small ?? ''}`;
        const existing = demandMap.get(key);
        demandMap.set(key, {
          subject: row.subject,
          big: cond.big,
          small: cond.small ?? '',
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
    // supply チェック: demand >= supply のカテゴリを学科別 Set に収録
    const result = {} as Record<TestSubject, Set<string>>;
    for (const [, demand] of demandMap) {
      // candidateIndex のキーは "subject::big::small" 形式（buildCandidateIndex と同形式）
      const smallKey = `${demand.subject}::${demand.big}::${demand.small}`;
      const supply =
        demand.small === ''
          ? (candidateIndex.byBigCategory.get(
              `${demand.subject}::${demand.big}`,
            )?.length ?? 0)
          : (candidateIndex.bySmallCategory.get(smallKey)?.length ?? 0);
      if (demand.count >= supply) {
        if (!result[demand.subject]) {
          result[demand.subject] = new Set<string>();
        }
        // "big/small" 形式（selectedCategories と同形式）で収録
        const categoryKey = demand.small
          ? `${demand.big}/${demand.small}`
          : demand.big;
        result[demand.subject].add(categoryKey);
      }
    }
    return result as Record<TestSubject, ReadonlySet<string>>;
  }, [stepTwo.categoryTable, candidateIndex]);

  /** categoryTable を CategoryCascadeSelect 用の行データに変換したもの */
  const categoryTableForUI = useMemo(
    (): CategoryRowForUI[] =>
      stepTwo.categoryTable.map((row) => ({
        id: row.id,
        subject: row.subject,
        selectedCategories: row.categoryConditions.map(
          (c) => `${c.big}/${c.small}`,
        ),
      })),
    [stepTwo.categoryTable],
  );

  // resetDifficulty: 自動リセットのため updateOptions・カテゴリ操作より前に定義
  const resetDifficulty = useCallback(() => {
    currentBfsTaskRef.current?.terminate();
    currentBfsTaskRef.current = null;
    useCreatePdfStatusRuntimeStore
      .getState()
      .actions.setIsBfsCalculating(false);
    setDifficulty({
      isCalculated: false,
      ratios: [30, 70],
      settableDifficultyRanges: null,
    });
  }, [setDifficulty]);

  const updateOptions = useCallback(
    (patch: Partial<CreatePdfCommonOptionDraftState>) => {
      let finalPatch = patch;
      if ('isShuffleChoices' in patch) {
        const wasOff = !stepTwo.options.isShuffleChoices;
        if (patch.isShuffleChoices === true && wasOff) {
          // false → true: 新しいシードを生成
          finalPatch = {
            ...patch,
            shuffleSeed: generateShuffleSeed(),
          };
        } else if (patch.isShuffleChoices === false) {
          // true → false: シードをクリア
          finalPatch = { ...patch, shuffleSeed: null };
        }
      }
      setOptions(finalPatch);
      // 漏れ条件変更時は難易度計算結果をリセット
      const affectsAvailability =
        'excludedTagIds' in patch ||
        'excludePastExam' in patch ||
        'excludeOriginal' in patch;
      if (affectsAvailability && stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      setOptions,
      stepTwo.options.isShuffleChoices,
      stepTwo.difficulty.isCalculated,
      resetDifficulty,
    ],
  );

  const updateDifficulty = useCallback(
    (patch: Partial<CreatePdfDifficultyDraftState>) => setDifficulty(patch),
    [setDifficulty],
  );

  // Exam の totalCount = 全学科の必要出題数の合計
  const totalCount = useMemo(
    () =>
      // reduce<number> を明示する。EXAM_REQUIRED_COUNTS_BY_GRADE は as const なので
      // 値がリテラル union になり、初期値 0 がその union に含まれる構成だと
      // 累算値が number へ広がらず型エラーになる。値の変更で壊れないよう固定する。
      Object.values(EXAM_REQUIRED_COUNTS_BY_GRADE[grade]).reduce<number>(
        (s, v) => s + v,
        0,
      ),
    [grade],
  );

  // 選択カテゴリに絞った難易度別集計。
  // categoryConditions が空の行は「条件なし = その科目の全問題を対象」として扱う。
  const availableTestCounts = useMemo(() => {
    const unconstrainedSubjects = new Set(
      stepTwo.categoryTable
        .filter((row) => row.categoryConditions.length === 0)
        .map((row) => row.subject),
    );
    const constrainedCategories = stepTwo.categoryTable.flatMap((row) =>
      row.categoryConditions.map((cond) => ({
        subject: row.subject,
        big: cond.big,
        small: cond.small,
      })),
    );
    return collectAvailableTestCounts(testDataByNo, (td) => {
      if (!td.active) return false;
      if (unconstrainedSubjects.has(td.subject)) return true;
      return constrainedCategories.some(
        (c) =>
          c.subject === td.subject &&
          c.big === td.bigCategoryTag &&
          c.small === td.smallCategoryTag,
      );
    });
  }, [testDataByNo, stepTwo.categoryTable]);

  // 確定スライダー位置から算出した難易度別目標問題数（本実装の executeDraw で使用）
  const committedCounts = useMemo(
    () =>
      stepTwo.difficulty.isCalculated &&
      stepTwo.difficulty.entityCount.some((count) => count > 0)
        ? stepTwo.difficulty.entityCount
        : calcCountsFromRatio(totalCount, stepTwo.difficulty.ratios),
    [totalCount, stepTwo.difficulty],
  );

  const isCalculateDisabled =
    isLoadingTestData || availableTestCounts.every((c) => c === 0);

  const fixedSignature = useMemo(
    () => createFixedDrawSlotsSignature(drawSlots),
    [drawSlots],
  );

  const [isBfsCalculating, setIsBfsCalculating] = useState(false);
  const currentBfsTaskRef = useRef<DifficultyFeasibilityTask | null>(null);
  const currentDrawTaskRef = useRef<DrawWithValidationWorkerTask | null>(null);
  const calculateRequestIdRef = useRef(0);
  const drawRequestIdRef = useRef(0);
  const previousFixedSignatureRef = useRef(fixedSignature);
  const latestDrawSlotsRef = useRef(drawSlots);
  const latestCandidateIndexRef = useRef(candidateIndex);
  const latestIsCalculatedRef = useRef(stepTwo.difficulty.isCalculated);
  const latestFixedSignatureRef = useRef(fixedSignature);
  const difficultyFeasibilityRef =
    useRef<DifficultyFeasibility>(EMPTY_FEASIBILITY);
  const [difficultyFeasibilitySnapshot, setDifficultyFeasibilitySnapshot] =
    useState<DifficultyFeasibility>(EMPTY_FEASIBILITY);

  latestDrawSlotsRef.current = drawSlots;
  latestCandidateIndexRef.current = candidateIndex;
  latestIsCalculatedRef.current = stepTwo.difficulty.isCalculated;
  latestFixedSignatureRef.current = fixedSignature;

  const setDifficultyFeasibility = useCallback(
    (feasibility: DifficultyFeasibility) => {
      difficultyFeasibilityRef.current = feasibility;
      setDifficultyFeasibilitySnapshot(feasibility);
    },
    [],
  );

  const difficultySliderDynamicBounds = useMemo(
    () =>
      stepTwo.difficulty.isCalculated
        ? calcDifficultySliderDynamicBounds(
            difficultyFeasibilitySnapshot.patterns,
            stepTwo.difficulty.ratios,
          )
        : null,
    [
      stepTwo.difficulty.isCalculated,
      stepTwo.difficulty.ratios,
      difficultyFeasibilitySnapshot,
    ],
  );

  const setBfsCalculating = useCallback((value: boolean) => {
    setIsBfsCalculating(value);
    useCreatePdfStatusRuntimeStore
      .getState()
      .actions.setIsBfsCalculating(value);
  }, []);

  useEffect(
    () => () => {
      currentDrawTaskRef.current?.terminate();
      currentDrawTaskRef.current = null;
    },
    [],
  );

  const refreshDifficultyForFixedRows = useCallback(
    async (params: { slots: readonly DrawSlot[]; index: CandidateIndex }) => {
      const { slots, index } = params;
      if (!useExamDraftStore.getState().stepTwo.difficulty.isCalculated) {
        setDifficultyFeasibility(EMPTY_FEASIBILITY);
        return;
      }

      const phase1 = prepareBfsFeasibility({
        slots,
        candidateIndex: index,
      });
      if (phase1.totalCount === 0) {
        setDifficultyFeasibility(EMPTY_FEASIBILITY);
        return;
      }

      const applyFeasibility = (feasibility: DifficultyFeasibility) => {
        const { stepTwo: latest, actions } = useExamDraftStore.getState();
        if (!latest.difficulty.isCalculated) return;
        const adjusted = adjustDifficultyByFeasibility({
          ratios: latest.difficulty.ratios,
          feasibility,
        });
        const prev = latest.difficulty;
        const prevRanges = prev.settableDifficultyRanges;
        const rangesChanged =
          prevRanges === null ||
          adjusted.settableDifficultyRanges.some(
            (r, i) =>
              r.min !== prevRanges[i]?.min || r.max !== prevRanges[i]?.max,
          );
        const ratiosChanged =
          adjusted.ratios[0] !== prev.ratios[0] ||
          adjusted.ratios[1] !== prev.ratios[1];
        const entityCountChanged = adjusted.entityCount.some(
          (c, i) => c !== prev.entityCount[i],
        );
        if (!rangesChanged && !ratiosChanged && !entityCountChanged) return;
        actions.setDifficulty({
          ratios: adjusted.ratios,
          entityCount: adjusted.entityCount,
          settableDifficultyRanges: adjusted.settableDifficultyRanges,
        });
      };

      currentBfsTaskRef.current?.terminate();
      currentBfsTaskRef.current = null;
      setBfsCalculating(false);

      const task = createDifficultyFeasibilityTask(phase1);
      currentBfsTaskRef.current = task;
      if (task.usedWorker) setBfsCalculating(true);
      try {
        const { feasibility } = await task.promise;
        if (currentBfsTaskRef.current !== task) return;
        setDifficultyFeasibility(feasibility);
        applyFeasibility(feasibility);
      } catch {
        if (currentBfsTaskRef.current !== task) return;
      } finally {
        if (currentBfsTaskRef.current === task) {
          if (task.usedWorker) setBfsCalculating(false);
          currentBfsTaskRef.current = null;
        }
      }
    },
    [setBfsCalculating, setDifficultyFeasibility],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 固定状態だけをトリガーにし、最新入力は ref 経由で渡す。
  useEffect(() => {
    if (!latestIsCalculatedRef.current) return;
    if (fixedSignature === previousFixedSignatureRef.current) return;
    previousFixedSignatureRef.current = fixedSignature;
    void refreshDifficultyForFixedRows({
      slots: latestDrawSlotsRef.current,
      index: latestCandidateIndexRef.current,
    });
  }, [fixedSignature]);

  useEffect(
    () => () => {
      currentBfsTaskRef.current?.terminate();
      currentBfsTaskRef.current = null;
      useCreatePdfStatusRuntimeStore
        .getState()
        .actions.setIsBfsCalculating(false);
    },
    [],
  );

  const calculateDifficulty = useCallback(async () => {
    const calculateRequestId = calculateRequestIdRef.current + 1;
    calculateRequestIdRef.current = calculateRequestId;
    const calculationFixedSignature = fixedSignature;
    const naturalRatios = calcNaturalRatios(availableTestCounts);
    const phase1 = prepareBfsFeasibility({ slots: drawSlots, candidateIndex });
    currentBfsTaskRef.current?.terminate();
    currentBfsTaskRef.current = null;
    setBfsCalculating(false);
    const task = createDifficultyFeasibilityTask(phase1);
    currentBfsTaskRef.current = task;
    let loadingId: string | null = null;
    try {
      if (task.usedWorker) {
        loadingId = useGlobalLoadingStore
          .getState()
          .show('難易度を計算しています…');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      const result = await task.promise;
      if (currentBfsTaskRef.current !== task) return;
      if (calculateRequestIdRef.current !== calculateRequestId) return;
      if (latestFixedSignatureRef.current !== calculationFixedSignature) return;
      previousFixedSignatureRef.current = calculationFixedSignature;
      setDifficultyFeasibility(result.feasibility);
      const adjustedDifficulty = adjustDifficultyByFeasibility({
        ratios: naturalRatios,
        feasibility: result.feasibility,
      });
      setDifficulty({
        isCalculated: true,
        ratios: adjustedDifficulty.ratios,
        entityCount: adjustedDifficulty.entityCount,
        settableDifficultyRanges: adjustedDifficulty.settableDifficultyRanges,
      });
    } catch {
      // 条件変更や連続操作で terminate された古い計算結果は反映しない。
    } finally {
      if (loadingId !== null) {
        useGlobalLoadingStore.getState().hide(loadingId);
      }
      if (currentBfsTaskRef.current === task) {
        currentBfsTaskRef.current = null;
      }
    }
  }, [
    availableTestCounts,
    drawSlots,
    candidateIndex,
    setDifficulty,
    setBfsCalculating,
    setDifficultyFeasibility,
    fixedSignature,
  ]);
  const onRatioCommit = useCallback(
    (ratio: [number, number]) => {
      const nearestPattern = findNearestAssignablePattern({
        patterns: difficultyFeasibilityRef.current.patterns,
        totalCount,
        ratios: ratio,
      });
      setDifficulty({
        ratios: ratio,
        entityCount:
          nearestPattern?.counts ?? calcCountsFromRatio(totalCount, ratio),
      });
    },
    [setDifficulty, totalCount],
  );

  /**
   * Step2 表示時に全問分の ExamCategoryTableRow を一括初期化する。
   * categoryTable が既に存在する場合は何もしない。
   * useTestTableStore にも同時に初期セクションを書き込む。
   */
  const initializeCategoryTableRows = useCallback(() => {
    if (stepTwo.categoryTable.length > 0) return;

    const newRows: ExamCategoryTableRow[] = [];
    const newSections: TestTableSection[] = [];

    for (const subject of EXAM_SUBJECTS_BY_GRADE[grade]) {
      const count =
        (EXAM_REQUIRED_COUNTS_BY_GRADE[grade] as Record<TestSubject, number>)[
          subject
        ] ?? 0;
      const subjectCategoryRows: ExamCategoryTableRow[] = [];
      for (let i = 0; i < count; i++) {
        const categoryRow: ExamCategoryTableRow = {
          id: createCreatePdfId('exam-frame-condition'),
          subject,
          categoryConditions: [],
        };
        subjectCategoryRows.push(categoryRow);
        newRows.push(categoryRow);
      }
      newSections.push({
        id: createCreatePdfId('section'),
        label: subject,
        subject,
        rows: subjectCategoryRows.map((categoryRow) => ({
          id: createCreatePdfId('row'),
          sourceConditionId: categoryRow.id,
          categoryTable: [],
          selectedNo: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
          hasError: false,
          errorMessage: null,
        })),
      });
    }
    replaceCategoryTableRows(newRows);
    const { basic, stepTwo: s, stepThree } = useExamDraftStore.getState();
    const drawConditionKey = createExamDrawConditionKey({
      basic,
      stepTwo: { ...s, categoryTable: newRows },
      stepThree,
    });
    applyDrawResult({ sections: newSections, drawConditionKey });
  }, [
    grade,
    stepTwo.categoryTable.length,
    replaceCategoryTableRows,
    applyDrawResult,
  ]);

  const addCategoryTableRow = useCallback(() => {
    if (isLoadingTestData) return;

    const nextSubject = getNextExamMockSubject(grade, stepTwo.categoryTable);
    if (nextSubject == null) return;

    const next: ExamCategoryTableRow = {
      id: createCreatePdfId('exam-frame-condition'),
      subject: nextSubject,
      categoryConditions: [],
    };
    const nextCategoryTableRows = [...stepTwo.categoryTable, next];
    const nextSections = [
      ...testTableSections,
      buildMockExamSection({
        grade,
        frameCondition: next,
        testDataByNo,
      }),
    ];

    replaceCategoryTableRows(nextCategoryTableRows);
    const { basic, stepTwo: s, stepThree } = useExamDraftStore.getState();
    const drawConditionKey = createExamDrawConditionKey({
      basic,
      stepTwo: { ...s, categoryTable: nextCategoryTableRows },
      stepThree,
    });
    applyDrawResult({ sections: nextSections, drawConditionKey });
    // カテゴリ追加時に難易度計算結果をリセット
    if (stepTwo.difficulty.isCalculated) {
      resetDifficulty();
    }
  }, [
    grade,
    isLoadingTestData,
    replaceCategoryTableRows,
    applyDrawResult,
    stepTwo.categoryTable,
    stepTwo.difficulty.isCalculated,
    testTableSections,
    testDataByNo,
    resetDifficulty,
  ]);

  const updateCategoryTableRow = useCallback(
    (conditionId: string, selected: string[]) => {
      const conditions: CategoryCondition[] = selected.map((v) => {
        const idx = v.indexOf('/');
        return { big: v.slice(0, idx), small: v.slice(idx + 1) };
      });

      replaceCategoryTableRows(
        stepTwo.categoryTable.map((c) =>
          c.id === conditionId ? { ...c, categoryConditions: conditions } : c,
        ),
      );
      // カテゴリ変更時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      replaceCategoryTableRows,
      resetDifficulty,
    ],
  );

  const removeCategoryTableRow = useCallback(
    (conditionId: string) => {
      const nextCategoryTableRows = stepTwo.categoryTable.filter(
        (condition) => condition.id !== conditionId,
      );
      const nextSections = testTableSections.filter(
        (section) => section.id !== conditionId,
      );

      replaceCategoryTableRows(nextCategoryTableRows);
      const { basic, stepTwo: s, stepThree } = useExamDraftStore.getState();
      const drawConditionKey = createExamDrawConditionKey({
        basic,
        stepTwo: { ...s, categoryTable: nextCategoryTableRows },
        stepThree,
      });
      applyDrawResult({ sections: nextSections, drawConditionKey });
      // カテゴリ削除時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      replaceCategoryTableRows,
      applyDrawResult,
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      testTableSections,
      resetDifficulty,
    ],
  );

  /** 抽選実行: 全学科の DrawSlot をまとめて抽選し、結果を学科別 section へ戻す */
  const executeDraw = useCallback(async () => {
    const drawRequestId = drawRequestIdRef.current + 1;
    drawRequestIdRef.current = drawRequestId;
    setDrawErrorMessage(null);
    let loadingId: string | null = null;
    let drawTask: DrawWithValidationWorkerTask | null = null;
    try {
      // isShuffleChoices === true の場合は再抽選のたびに新しいシードを生成する
      // setOptions 後に getState() してシード更新済みの状態を取得する（キーとの不一致防止）
      if (useExamDraftStore.getState().stepTwo.options.isShuffleChoices) {
        setOptions({ shuffleSeed: generateShuffleSeed() });
      }
      const {
        basic,
        stepTwo: latestStepTwo,
        stepThree,
      } = useExamDraftStore.getState();
      const currentSections = useTestTableStore.getState().sections;
      const linkedCurrentSections = reconnectExamTableRowsToCategoryRows({
        categoryRows: latestStepTwo.categoryTable,
        sections: currentSections,
      });
      const normalized = trimExamCategoryRowsToRequiredCounts(
        grade,
        latestStepTwo.categoryTable,
      );
      const effectiveCategoryTable = normalized.rows;
      const sectionsForDraw =
        normalized.removedCount > 0
          ? buildExamSectionsFromCategoryRows({
              grade,
              categoryRows: effectiveCategoryTable,
              currentSections: linkedCurrentSections,
            })
          : reconnectExamTableRowsToCategoryRows({
              categoryRows: effectiveCategoryTable,
              sections: linkedCurrentSections,
            });
      if (normalized.removedCount > 0) {
        console.warn('[createPdf:exam] category rows normalized before draw', {
          removedCount: normalized.removedCount,
          requiredCounts: EXAM_REQUIRED_COUNTS_BY_GRADE[grade],
          beforeCounts: countRowsBySubject(latestStepTwo.categoryTable),
          afterCounts: countRowsBySubject(effectiveCategoryTable),
        });
        replaceCategoryTableRows(effectiveCategoryTable);
      }

      console.debug('[createPdf:exam] draw invariant', {
        requiredCounts: EXAM_REQUIRED_COUNTS_BY_GRADE[grade],
        categoryRowsBySubject: countRowsBySubject(effectiveCategoryTable),
        sectionsRowsBySubject: Object.fromEntries(
          sectionsForDraw.map((section) => [
            section.label,
            section.rows.length,
          ]),
        ),
        fixedRowsBySubject: Object.fromEntries(
          sectionsForDraw.map((section) => [
            section.label,
            section.rows.filter((row) => row.isFixed).length,
          ]),
        ),
      });

      const allSlots: DrawSlot[] = [];
      const slotSubjects: TestSubject[] = [];
      const categoryRowsBySubject = new Map<
        TestSubject,
        ExamCategoryTableRow[]
      >();

      for (const subject of EXAM_SUBJECTS_BY_GRADE[grade]) {
        const subjectCategoryRows = effectiveCategoryTable.filter(
          (r) => r.subject === subject,
        );
        if (subjectCategoryRows.length === 0) continue;
        categoryRowsBySubject.set(subject, subjectCategoryRows);

        // この学科に対応するセクションから固定行を取得
        const subjectSection = sectionsForDraw.find((s) => s.label === subject);
        const subjectFixedRows =
          subjectSection?.rows.filter((r) => r.isFixed) ?? [];

        // フェーズ1: DrawSlot 展開
        const slots = buildExamDrawSlots(
          subjectCategoryRows,
          subjectFixedRows,
          grade,
        );
        allSlots.push(...slots);
        slotSubjects.push(...slots.map(() => subject));
      }

      // 難易度調整は「模擬試験全体」で判定するため、学科ごとではなく一括で抽選する。
      const drawParams = {
        slots: allSlots,
        index: candidateIndex,
        difficulty: latestStepTwo.difficulty,
      };
      if (
        latestStepTwo.difficulty.isCalculated &&
        latestStepTwo.difficulty.entityCount.some((count) => count > 0) &&
        difficultyFeasibilityRef.current.assignableCountKeys.size > 0 &&
        !difficultyFeasibilityRef.current.assignableCountKeys.has(
          createDifficultyCountKey(latestStepTwo.difficulty.entityCount),
        )
      ) {
        setDrawErrorMessage(
          '現在の難易度比率の組み合わせでは抽選できません。難易度を計算し直すか、比率を調整してください。',
        );
        return;
      }
      const useDrawWorker = shouldRunDrawInWorker({
        slots: allSlots,
        index: candidateIndex,
      });
      if (useDrawWorker) {
        loadingId = useGlobalLoadingStore.getState().show('抽選中…');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      const result = await (async () => {
        if (!useDrawWorker) return runDrawWithValidation(drawParams);
        currentDrawTaskRef.current?.terminate();
        drawTask = createDrawWithValidationWorkerTask(drawParams);
        currentDrawTaskRef.current = drawTask;
        return drawTask.promise;
      })();

      if (drawRequestIdRef.current !== drawRequestId) return;
      if (drawTask !== null && currentDrawTaskRef.current !== drawTask) return;

      if (!result.ok) {
        setDrawErrorMessage(result.userMessage);
        return;
      }

      const rowsBySubject = new Map<TestSubject, TestTableRow[]>();
      result.result.rows.forEach((row, index) => {
        const subject = slotSubjects[index];
        if (subject === undefined) return;
        const rows = rowsBySubject.get(subject) ?? [];
        rows.push(row);
        rowsBySubject.set(subject, rows);
      });

      const resultSections: TestTableSection[] = [];
      for (const subject of EXAM_SUBJECTS_BY_GRADE[grade]) {
        if (!categoryRowsBySubject.has(subject)) continue;
        const subjectSection = sectionsForDraw.find((s) => s.label === subject);
        resultSections.push({
          id: subjectSection?.id ?? createCreatePdfId('section'),
          label: subject,
          subject,
          rows: rowsBySubject.get(subject) ?? [],
        });
      }

      const drawConditionKey = createExamDrawConditionKey({
        basic,
        stepTwo: { ...latestStepTwo, categoryTable: effectiveCategoryTable },
        stepThree,
      });
      applyDrawResult({ sections: resultSections, drawConditionKey });
    } catch {
      if (drawTask !== null && currentDrawTaskRef.current !== drawTask) return;
      setDrawErrorMessage(
        '抽選中にエラーが発生しました。もう一度お試しください。',
      );
    } finally {
      if (drawTask !== null && currentDrawTaskRef.current === drawTask) {
        currentDrawTaskRef.current = null;
      }
      if (loadingId !== null) {
        useGlobalLoadingStore.getState().hide(loadingId);
      }
    }
  }, [
    grade,
    candidateIndex,
    applyDrawResult,
    setOptions,
    replaceCategoryTableRows,
  ]);

  const updateTableRow = useCallback(
    (
      sectionId: string,
      rowId: string,
      patch: Partial<
        Pick<
          TestTableRow,
          'selectedNo' | 'qaaChoiceIndex' | 'isFixed' | 'pageBreakBefore'
        >
      >,
    ) => updateRowInStore(sectionId, rowId, patch),
    [updateRowInStore],
  );

  return {
    options: stepTwo.options,
    difficulty: stepTwo.difficulty,
    categoryTable: stepTwo.categoryTable,
    isLoadingTestData,
    updateOptions,
    updateDifficulty,
    availableTestCounts,
    totalCount,
    committedCounts,
    difficultySliderDynamicBounds,
    calculateDifficulty,
    // resetDifficulty は返さない（自動リセットのみ）
    isCalculateDisabled,
    onRatioCommit,
    addCategoryTableRow,
    updateCategoryTableRow,
    removeCategoryTableRow,
    categoryTreeBySubject,
    categoryTableForUI,
    exhaustedCategoryKeysBySubject,
    // drawButtonDisabled: !drawStatus.canDraw,
    drawErrorMessage,
    clearDrawErrorMessage: () => setDrawErrorMessage(null),
    initializeCategoryTableRows,
    executeDraw,
    isBfsCalculating,
    updateTableRow,
  };
};

export default useExamStepTwo;

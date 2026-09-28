import { generateShuffleSeed } from '@api/shuffleSeed';
import type { TestSubject } from '@shared/types/contracts';
import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import type { CandidateIndex } from '@views/createPdf/api/candidateIndex';
import {
  buildCategoryTreeBySubject,
  type CategoryTreeBySubject,
} from '@views/createPdf/api/categoryUtils';
import { createCreatePdfId } from '@views/createPdf/api/common';
import { shouldShowQaaChoiceIndexForWorkbookMode } from '@views/createPdf/api/conditionJsonConverter';
import { createWorkbookDrawConditionKey } from '@views/createPdf/api/createPdfConditionKeys';
import {
  deriveCreatePdfCandidateIndex,
  filterTestDataBySelectedYears,
} from '@views/createPdf/api/createPdfDerivedInputs';
import {
  createDifficultyFeasibilityTask,
  createFixedDrawSlotsSignature,
  type DifficultyFeasibilityTask,
} from '@views/createPdf/api/difficultyFeasibilityRunner';
import {
  type AvailableDifficultyTestCounts,
  adjustDifficultyByFeasibility,
  calcCountsFromRatio,
  calcDifficultySliderDynamicBounds,
  calcNaturalRatios,
  collectAvailableTestCountsByCategories,
  createDifficultyCountKey,
  type DifficultyFeasibility,
  type DifficultySliderDynamicBounds,
  findNearestAssignablePattern,
  prepareBfsFeasibility,
} from '@views/createPdf/api/difficultyUtils';
import {
  buildWorkbookDrawSlots,
  type DrawSlot,
} from '@views/createPdf/api/drawEngine';
import { runDrawWithValidation } from '@views/createPdf/api/drawWithValidation';
import {
  createDrawWithValidationWorkerTask,
  type DrawWithValidationWorkerTask,
  shouldRunDrawInWorker,
} from '@views/createPdf/api/drawWorkerClient';
import {
  createStableWorkbookCategoryTableRow,
  createWorkbookCategoryTableRow,
  replaceWorkbookCategoryTableRow,
} from '@views/createPdf/api/workbookConditions';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type {
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
} from '@views/createPdf/types/draftState';
import type { TestTableSection } from '@views/createPdf/types/testTable';
import { DEFAULT_TEST_TABLE_SECTION_SUBJECT } from '@views/createPdf/types/testTable';
import type {
  WorkbookCategoryTableRow,
  WorkbookMode,
} from '@views/createPdf/types/viewState';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

const WORKBOOK_MODE_LABEL: Record<WorkbookMode, string> = {
  qaa: '一問一答',
  qaaAllTrue: '一問一答（全問◯）',
  qaaAllFalse: '一問一答（全問×）',
  multipleChoice: '選択肢',
};

const resolveWorkbookSectionSubject = (
  conditions: readonly WorkbookCategoryTableRow[],
): TestSubject => {
  const subjects = new Set<TestSubject>();
  for (const condition of conditions) {
    if (condition.subject !== null) {
      subjects.add(condition.subject as TestSubject);
    }
  }

  if (subjects.size === 1) {
    return [...subjects][0] ?? DEFAULT_TEST_TABLE_SECTION_SUBJECT;
  }
  return DEFAULT_TEST_TABLE_SECTION_SUBJECT;
};

const createWorkbookSelectionCategoryTableRow = (
  initial: Pick<
    WorkbookCategoryTableRow,
    'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
  >,
): WorkbookCategoryTableRow =>
  initial.subject !== null && initial.bigCategoryTag !== null
    ? createStableWorkbookCategoryTableRow({
        ...initial,
        subject: initial.subject,
        bigCategoryTag: initial.bigCategoryTag,
      })
    : createWorkbookCategoryTableRow(initial);

export type UseWorkbookStepTwoOutput = {
  workbookMode: WorkbookMode;
  options: CreatePdfCommonOptionDraftState;
  difficulty: CreatePdfDifficultyDraftState;
  categoryTable: WorkbookCategoryTableRow[];
  updateWorkbookMode: (value: WorkbookMode) => void;
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
  addCategoryCondition: (
    initial: Pick<
      WorkbookCategoryTableRow,
      'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
    >,
  ) => void;
  /** 大カテゴリ全選択用: 複数の小分類条件を一括追加する */
  addCategoryConditions: (
    initials: Array<
      Pick<
        WorkbookCategoryTableRow,
        'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
      >
    >,
  ) => void;
  updateCategoryCondition: (
    conditionId: string,
    updater: (c: WorkbookCategoryTableRow) => WorkbookCategoryTableRow,
  ) => void;
  removeCategoryCondition: (conditionId: string) => void;
  /** 大カテゴリ全解除用: 複数の小分類条件を一括削除する */
  removeCategoryConditions: (conditionIds: string[]) => void;
  /** 学科別大分類・小分類ツリー（WorkbookCategoryTableRow component の選択肢供給用） */
  categoryTreeBySubject: CategoryTreeBySubject;
  /** 小分類ごとの問題数上限。key: "subject::bigCategoryTag::smallCategoryTag" */
  maxCountBySmallKey: ReadonlyMap<string, number>;
  // drawButtonDisabled: boolean;
  drawErrorMessage: string | null;
  clearDrawErrorMessage: () => void;
  /** 仮抽選実行: categoryTable の count 分の仮問題行を生成 */
  executeDraw: () => Promise<void>;
  isBfsCalculating: boolean;
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
 * workbook Step2 固有ロジックを扱う mode hook。
 * useWorkbookDraftStore を直接操作し、panel model へ公開する。
 */
const useWorkbookStepTwo = (input: {
  selectedYearNos: ReadonlySet<number> | null;
}): UseWorkbookStepTwoOutput => {
  const { selectedYearNos } = input;
  const [drawErrorMessage, setDrawErrorMessage] = useState<string | null>(null);
  const {
    basic,
    stepTwo,
    setWorkbookMode,
    setOptions,
    setDifficulty,
    replaceCategoryConditions,
  } = useWorkbookDraftStore(
    useShallow((s) => ({
      basic: s.basic,
      stepTwo: s.stepTwo,
      setWorkbookMode: s.actions.setWorkbookMode,
      setOptions: s.actions.setOptions,
      setDifficulty: s.actions.setDifficulty,
      replaceCategoryConditions: s.actions.replaceCategoryConditions,
    })),
  );

  const { testCategory, testDataByNo } = useCreatePdfResourceStore(
    useShallow((s) => ({
      testCategory: s.testCategory,
      testDataByNo: s.testData.maps.byNo,
    })),
  );

  const { applyDrawResult, setSettings, sections } = useTestTableStore(
    useShallow((s) => ({
      applyDrawResult: s.actions.applyDrawResult,
      setSettings: s.actions.setSettings,
      sections: s.sections,
    })),
  );
  const isLoadingTestData = useCreatePdfResourceStore(
    (s) => s.testData.isLoading,
  );

  const categoryTreeBySubject = useMemo(
    () => buildCategoryTreeBySubject(testCategory),
    [testCategory],
  );

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
        workbookMode: stepTwo.workbookMode,
        grade: basic.grade,
        options: stepTwo.options,
      }),
    [
      filteredTestDataByNo,
      testDataByNo,
      basic.grade,
      stepTwo.workbookMode,
      stepTwo.options.excludedTagIds,
      stepTwo.options.excludePastExam,
      stepTwo.options.excludeOriginal,
    ],
  );

  /** 小分類ごとの候補問題数上限。key: "subject::big::small"（buildCandidateIndex と同形式） */
  const maxCountBySmallKey = useMemo<ReadonlyMap<string, number>>(
    () =>
      new Map(
        [...candidateIndex.bySmallCategory.entries()].map(([k, nos]) => [
          k,
          nos.length,
        ]),
      ),
    [candidateIndex],
  );

  /** 固定行: sections から isFixed=true の行を抽出 */

  const fixedRows = useMemo(
    () => sections.flatMap((s) => s.rows.filter((r) => r.isFixed)),
    [sections],
  );

  const allCurrentRows = useMemo(
    () => sections.flatMap((section) => section.rows),
    [sections],
  );

  const drawSlots = useMemo(
    () =>
      buildWorkbookDrawSlots(stepTwo.categoryTable, fixedRows, allCurrentRows),
    [stepTwo.categoryTable, fixedRows, allCurrentRows],
  );
  /*
  const conditionRequirements = useMemo(
    () =>
      new Map(
        stepTwo.categoryTable.map((row) => [row.id, Math.max(0, row.count)]),
      ),
    [stepTwo.categoryTable],
  );

  const activeConditionIds = useMemo(
    () => deriveActiveConditionIds(stepTwo.categoryTable),
    [stepTwo.categoryTable],
  );

  const testTableChecks = useMemo(
    () =>
      deriveCreatePdfTestTableChecksCached({
        sections,
        testDataByNo,
        showQaaChoiceIndex: stepTwo.workbookMode !== 'multipleChoice',
        grade: basic.grade,
        sectionMode: 'single',
        activeConditionIds,
      }),
    [
      sections,
      testDataByNo,
      stepTwo.workbookMode,
      basic.grade,
      activeConditionIds,
    ],
  );
/*
  const drawStatus = useMemo(
    () =>
      deriveCreatePdfDrawStatus({
        hasCategoryConditions: stepTwo.categoryTable.some(
          (row) => row.subject !== null && row.bigCategoryTag !== null,
        ),
        candidateIndex,
        testTableChecks,
        slots: drawSlots,
        fixedRows,
        conditionRequirements,
      }),
    [
      stepTwo.categoryTable,
      candidateIndex,
      testTableChecks,
      drawSlots,
      fixedRows,
      conditionRequirements,
    ],
  );
  */

  const updateWorkbookMode = useCallback(
    (value: WorkbookMode) => setWorkbookMode(value),
    [setWorkbookMode],
  );

  // resetDifficulty: 自動リセットのため updateOptions ・カテゴリ操作より前に定義
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

  // Workbook の totalCount = categoryTable の count 合計
  const totalCount = useMemo(
    () => stepTwo.categoryTable.reduce((s, c) => s + c.count, 0),
    [stepTwo.categoryTable],
  );

  // カテゴリ条件に合致する問題の難易度別集計（subject/big/small が未設定の行は除外）
  const availableTestCounts = useMemo(
    () =>
      collectAvailableTestCountsByCategories(
        testDataByNo,
        stepTwo.categoryTable.flatMap((c) =>
          c.subject !== null &&
          c.bigCategoryTag !== null &&
          c.smallCategoryTag !== null
            ? [
                {
                  subject: c.subject,
                  big: c.bigCategoryTag,
                  small: c.smallCategoryTag,
                },
              ]
            : [],
        ),
      ),
    [testDataByNo, stepTwo.categoryTable],
  );

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
      if (!useWorkbookDraftStore.getState().stepTwo.difficulty.isCalculated) {
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
        const { stepTwo: latest, actions } = useWorkbookDraftStore.getState();
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

  // ドラッグ終了: コンポーネントからクランプ済み ratios を受け取って store に確定（entityCount も同時更新）
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

  const addCategoryCondition = useCallback(
    (
      initial: Pick<
        WorkbookCategoryTableRow,
        'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
      >,
    ) => {
      replaceCategoryConditions([
        ...stepTwo.categoryTable,
        createWorkbookSelectionCategoryTableRow(initial),
      ]);
      // カテゴリ追加時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      replaceCategoryConditions,
      resetDifficulty,
    ],
  );

  const addCategoryConditions = useCallback(
    (
      initials: Array<
        Pick<
          WorkbookCategoryTableRow,
          'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
        >
      >,
    ) => {
      const newRows = initials.map(createWorkbookSelectionCategoryTableRow);
      replaceCategoryConditions([...stepTwo.categoryTable, ...newRows]);
      // カテゴリ一括追加時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      replaceCategoryConditions,
      resetDifficulty,
    ],
  );

  const removeCategoryConditions = useCallback(
    (conditionIds: string[]) => {
      const idSet = new Set(conditionIds);
      replaceCategoryConditions(
        stepTwo.categoryTable.filter((c) => !idSet.has(c.id)),
      );
      // カテゴリ一括削除時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      replaceCategoryConditions,
      resetDifficulty,
    ],
  );

  const updateCategoryCondition = useCallback(
    (
      conditionId: string,
      updater: (c: WorkbookCategoryTableRow) => WorkbookCategoryTableRow,
    ) => {
      replaceCategoryConditions(
        replaceWorkbookCategoryTableRow(
          stepTwo.categoryTable,
          conditionId,
          updater,
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
      replaceCategoryConditions,
      resetDifficulty,
    ],
  );

  const removeCategoryCondition = useCallback(
    (conditionId: string) => {
      replaceCategoryConditions(
        stepTwo.categoryTable.filter((c) => c.id !== conditionId),
      );
      // カテゴリ削除時に難易度計算結果をリセット
      if (stepTwo.difficulty.isCalculated) {
        resetDifficulty();
      }
    },
    [
      stepTwo.categoryTable,
      stepTwo.difficulty.isCalculated,
      replaceCategoryConditions,
      resetDifficulty,
    ],
  );

  /**
   * 抽選実行（フェーズ1+2+3）: DrawSlot 展開 → runDrawEngine → qaaChoiceIndex 付与 → applyDrawResult
   */
  const executeDraw = useCallback(async () => {
    const drawRequestId = drawRequestIdRef.current + 1;
    drawRequestIdRef.current = drawRequestId;
    setDrawErrorMessage(null);
    const { workbookMode, difficulty } = stepTwo;
    if (
      difficulty.isCalculated &&
      difficulty.entityCount.some((count) => count > 0) &&
      difficultyFeasibilityRef.current.assignableCountKeys.size > 0 &&
      !difficultyFeasibilityRef.current.assignableCountKeys.has(
        createDifficultyCountKey(difficulty.entityCount),
      )
    ) {
      setDrawErrorMessage(
        '現在の難易度比率の組み合わせでは抽選できません。難易度を計算し直すか、比率を調整してください。',
      );
      return;
    }
    const useDrawWorker = shouldRunDrawInWorker({
      slots: drawSlots,
      index: candidateIndex,
    });
    const loadingId = useDrawWorker
      ? useGlobalLoadingStore.getState().show('抽選中…')
      : null;
    let drawTask: DrawWithValidationWorkerTask | null = null;
    try {
      if (loadingId !== null) {
        // 1フレーム確定させてからメインスレッドの重い処理を実行する
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      // isShuffleChoices === true の場合は再抽選のたびに新しいシードを生成する
      if (stepTwo.options.isShuffleChoices) {
        setOptions({ shuffleSeed: generateShuffleSeed() });
      }

      // フェーズ1: DrawSlot 展開（allCurrentRows を渡して固定行の位置を保持）
      // フェーズ2: 抽選エンジン（選択肢確定まで統合済み）
      const drawParams = {
        slots: drawSlots,
        index: candidateIndex,
        difficulty,
        workbookMode,
      };
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

      const {
        basic: latestBasic,
        stepTwo: s,
        stepThree,
      } = useWorkbookDraftStore.getState();
      const nextSections: TestTableSection[] = [
        {
          id: createCreatePdfId('section'),
          label: WORKBOOK_MODE_LABEL[workbookMode],
          subject: resolveWorkbookSectionSubject(s.categoryTable),
          rows: result.result.rows,
        },
      ];
      const drawConditionKey = createWorkbookDrawConditionKey({
        basic: latestBasic,
        stepTwo: s,
        stepThree,
      });
      applyDrawResult({ sections: nextSections, drawConditionKey });
      setSettings({
        showQaaChoiceIndex:
          shouldShowQaaChoiceIndexForWorkbookMode(workbookMode),
      });
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
    stepTwo,
    drawSlots,
    candidateIndex,
    applyDrawResult,
    setSettings,
    setOptions,
  ]);

  return {
    workbookMode: stepTwo.workbookMode,
    options: stepTwo.options,
    difficulty: stepTwo.difficulty,
    categoryTable: stepTwo.categoryTable,
    updateWorkbookMode,
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
    addCategoryCondition,
    addCategoryConditions,
    updateCategoryCondition,
    removeCategoryCondition,
    removeCategoryConditions,
    categoryTreeBySubject,
    maxCountBySmallKey,
    // drawButtonDisabled: !drawStatus.canDraw,
    drawErrorMessage,
    clearDrawErrorMessage: () => setDrawErrorMessage(null),
    executeDraw,
    isBfsCalculating,
  };
};

export default useWorkbookStepTwo;

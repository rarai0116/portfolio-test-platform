import type { TestData } from '@shared/types/contracts';
import { describe, expect, it, vi } from 'vitest';
import { buildCandidateIndex } from './candidateIndex';
import {
  buildExamDrawSlots,
  buildWorkbookDrawSlots,
  runDrawEngine,
} from './drawEngine';

// ─── テスト用共通ファクトリ ───────────────────

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
  ch3: '選択肢3',
  ch4: '選択肢4',
  ch5: '選択肢5',
  difficult: '1',
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: '',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
  ...overrides,
});

const defaultOptions = {
  excludedTagIds: [],
  excludePastExam: false,
  excludeOriginal: false,
  isShuffleChoices: false,
  shuffleSeed: null,
};

const defaultDifficulty = {
  isEnabled: false,
  isCalculated: false,
  ratios: [50, 50] as [number, number],
  entityCount: [0, 0, 0] as [number, number, number],
  settableDifficultyRanges: null,
};

const makeMap = (...rows: TestData[]): ReadonlyMap<number, TestData> =>
  new Map(rows.map((d) => [d.no, d]));

const makeIndex = (...rows: TestData[]) =>
  buildCandidateIndex({
    testDataByNo: makeMap(...rows),
    options: defaultOptions,
  });

/** qaa系テスト用: workbookMode='qaa' + grade でインデックス構築 */
const makeQaaIndex = (grade: 1 | 2, ...rows: TestData[]) =>
  buildCandidateIndex({
    testDataByNo: makeMap(...rows),
    workbookMode: 'qaa',
    grade,
    options: defaultOptions,
  });

// ─── buildWorkbookDrawSlots ─────────────────

describe('buildWorkbookDrawSlots', () => {
  it('条件行 count=3 → 3 スロットが生成される', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 3,
      },
    ];
    const slots = buildWorkbookDrawSlots(conditions, []);
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.sourceConditionId === 'cond-1')).toBe(true);
    expect(slots.every((s) => s.fixedNo === null)).toBe(true);
  });

  it('count=0 の条件行はスロットを生成しない', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 0,
      },
    ];
    const slots = buildWorkbookDrawSlots(conditions, []);
    expect(slots).toHaveLength(0);
  });

  it('subject が null の条件行はスキップされる', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: null,
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 2,
      },
    ];
    const slots = buildWorkbookDrawSlots(conditions, []);
    expect(slots).toHaveLength(0);
  });

  it('固定行は対応する条件行のスロットに fixedNo として設定される', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 3,
      },
    ];
    const fixedRow = {
      id: 'row-1',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '10',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(conditions, [fixedRow]);
    // 固定スロット 1 + 非固定スロット 2 = 3 スロット
    expect(slots).toHaveLength(3);
    const fixed = slots.filter((s) => s.fixedNo !== null);
    const nonFixed = slots.filter((s) => s.fixedNo === null);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]?.fixedNo).toBe('10');
    // qaaChoiceIndex=null の固定行 → fixedChoiceIndex=null
    expect(fixed[0]?.fixedChoiceIndex).toBeNull();
    expect(nonFixed).toHaveLength(2);
  });

  it('qaa系固定行の qaaChoiceIndex 非 null: fixedChoiceIndex にセットされる', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 1,
      },
    ];
    const fixedRow = {
      id: 'row-1',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '10',
      qaaChoiceIndex: 2, // 非 null: fixedChoiceIndex=2 になる
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(conditions, [fixedRow]);
    const fixed = slots.find((s) => s.fixedNo !== null);
    expect(fixed?.fixedChoiceIndex).toBe(2);
  });

  it('孤立固定行（削除済み条件 ID）は末尾に sourceConditionId=null で追加される', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: null,
        count: 1,
      },
    ];
    const orphanRow = {
      id: 'row-orphan',
      sourceConditionId: 'deleted-cond-99', // 存在しない条件 ID
      categoryTable: [],
      selectedNo: '99',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(conditions, [orphanRow]);
    // 通常スロット 1 + 孤立スロット 1
    expect(slots).toHaveLength(2);
    const orphan = slots.at(-1);
    expect(orphan?.sourceConditionId).toBeNull();
    expect(orphan?.fixedNo).toBe('99');
  });

  it('isFixed=false の行は固定スロットにならない', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: null,
        count: 2,
      },
    ];
    const nonFixedRow = {
      id: 'row-1',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '10',
      qaaChoiceIndex: null,
      isFixed: false, // 固定フラグが立っていない
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(conditions, [nonFixedRow]);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.fixedNo === null)).toBe(true);
  });

  it('allRows を渡すと固定行が元の位置を保持してスロットに配置される', () => {
    const conditions = [
      {
        id: 'cond-1',
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
        count: 4,
      },
    ];
    const makeRow = (
      id: string,
      selectedNo: string | null,
      isFixed: boolean,
    ) => ({
      id,
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo,
      qaaChoiceIndex: null,
      isFixed,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    });
    const allRows = [
      makeRow('row-1', '5', false), // 位置0: 非固定
      makeRow('row-2', '10', true), // 位置1: 固定
      makeRow('row-3', '11', true), // 位置2: 固定
      makeRow('row-4', '7', false), // 位置3: 非固定
    ];
    const fixedRows = allRows.filter((r) => r.isFixed);

    const slots = buildWorkbookDrawSlots(conditions, fixedRows, allRows);

    expect(slots).toHaveLength(4);
    // 固定行が元の位置 (1, 2) を保持し、先頭にまとめられないことを確認
    expect(slots[0]?.fixedNo).toBeNull(); // 位置0: 非固定スロット
    expect(slots[1]?.fixedNo).toBe('10'); // 位置1: 固定(10)
    expect(slots[2]?.fixedNo).toBe('11'); // 位置2: 固定(11)
    expect(slots[3]?.fixedNo).toBeNull(); // 位置3: 非固定スロット
  });
});

// ─── buildExamDrawSlots ────────────────────

describe('buildExamDrawSlots', () => {
  it('各 ExamCategoryTableRow が 1 スロットに変換される', () => {
    const categoryTable = [
      {
        id: 'frame-1',
        subject: '学科Ⅰ' as const,
        categoryConditions: [{ big: '大分類A', small: '小分類A-1' }],
      },
      {
        id: 'frame-2',
        subject: '学科Ⅱ' as const,
        categoryConditions: [],
      },
    ];
    const slots = buildExamDrawSlots(categoryTable, [], 1);
    expect(slots).toHaveLength(2);
    expect(slots[0]?.sourceConditionId).toBe('frame-1');
    expect(slots[0]?.conditions).toEqual([
      { big: '大分類A', small: '小分類A-1' },
    ]);
    expect(slots[1]?.sourceConditionId).toBe('frame-2');
    expect(slots[1]?.conditions).toEqual([]);
  });

  it('categoryConditions が空のスロットは conditions=[] になる', () => {
    const categoryTable = [
      {
        id: 'frame-1',
        subject: '学科Ⅰ' as const,
        categoryConditions: [],
      },
    ];
    const slots = buildExamDrawSlots(categoryTable, [], 1);
    expect(slots[0]?.conditions).toHaveLength(0);
  });

  it('固定行が対応する枠に fixedNo として設定される', () => {
    const categoryTable = [
      {
        id: 'frame-1',
        subject: '学科Ⅰ' as const,
        categoryConditions: [],
      },
    ];
    const fixedRow = {
      id: 'row-1',
      sourceConditionId: 'frame-1',
      categoryTable: [],
      selectedNo: '42',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildExamDrawSlots(categoryTable, [fixedRow], 1);
    expect(slots[0]?.fixedNo).toBe('42');
  });

  it('孤立固定行は末尾に sourceConditionId=null で追加される', () => {
    const categoryTable = [
      {
        id: 'frame-1',
        subject: '学科Ⅰ' as const,
        categoryConditions: [],
      },
    ];
    const orphanRow = {
      id: 'row-orphan',
      sourceConditionId: 'deleted-frame-99',
      categoryTable: [],
      selectedNo: '99',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildExamDrawSlots(categoryTable, [orphanRow], 1);
    expect(slots).toHaveLength(2);
    const orphan = slots.at(-1);
    expect(orphan?.sourceConditionId).toBeNull();
    expect(orphan?.fixedNo).toBe('99');
  });
});

// ─── runDrawEngine ─────────────────────────

describe('runDrawEngine', () => {
  it('候補から 1 問が選出され selectedNo に設定される', () => {
    const index = makeIndex(baseTestData(1), baseTestData(2), baseTestData(3));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.selectedNo).toBeTruthy();
    expect(['1', '2', '3']).toContain(result.rows[0]?.selectedNo);
  });

  it('複数スロットで重複排除される', () => {
    // 候補が3問で3スロット分を選出 → 各 no が重複しない
    const index = makeIndex(baseTestData(1), baseTestData(2), baseTestData(3));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 3,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    const nos = result.rows.map((r) => r.selectedNo);
    expect(new Set(nos).size).toBe(3); // 全部重複なし
  });

  it('候補不足の場合 hasError=true になり errorRows に記録される', () => {
    // 候補 2 問に対し 3 スロット → 3 番目が失敗
    const index = makeIndex(baseTestData(1), baseTestData(2));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 3,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(true);
    expect(result.errorRows).toHaveLength(1);
    const errorRow = result.rows.find((r) => r.hasError);
    expect(errorRow?.hasError).toBe(true);
    expect(errorRow?.errorMessage).toContain('候補不足');
  });

  it('候補が存在しないスロットは errorMessage に subject と条件が含まれる', () => {
    const index = makeIndex(); // 空インデックス
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.rows[0]?.errorMessage).toContain('学科Ⅰ');
  });

  it('固定スロットは selectedNo が fixedNo のまま確定し isFixed=true になる', () => {
    const index = makeIndex(baseTestData(1), baseTestData(2));
    const fixedRow = {
      id: 'row-1',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '99',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 2,
        },
      ],
      [fixedRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    const fixed = result.rows.find((r) => r.isFixed);
    expect(fixed?.selectedNo).toBe('99');
    // 固定 no '99' は他の行に選出されない
    const others = result.rows.filter((r) => !r.isFixed);
    expect(others.every((r) => r.selectedNo !== '99')).toBe(true);
  });

  it('固定 no は重複排除セットに先行登録され他スロットから選出されない', () => {
    // no=1,2 の候補のうち no=1 を固定 → 残りスロットは no=2 のみ選出可能
    const index = makeIndex(baseTestData(1), baseTestData(2));
    const fixedRow = {
      id: 'row-fixed',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '1',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 2,
        },
      ],
      [fixedRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    const nos = result.rows.map((r) => r.selectedNo);
    expect(nos).toContain('1');
    expect(nos).toContain('2');
    expect(new Set(nos).size).toBe(2);
  });

  it('孤立固定行は sourceConditionId=null / isFixed=true の行として生成される', () => {
    const index = makeIndex(baseTestData(1));
    const orphanRow = {
      id: 'row-orphan',
      sourceConditionId: 'deleted-cond',
      categoryTable: [],
      selectedNo: '99',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [orphanRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    const orphanResult = result.rows.find(
      (r) => r.isFixed && r.selectedNo === '99',
    );
    expect(orphanResult?.sourceConditionId).toBeNull();
    expect(orphanResult?.isFixed).toBe(true);
  });

  it('Math.random=0 固定でもシャッフル処理でエラーにならない', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const index = makeIndex(baseTestData(1), baseTestData(2), baseTestData(3));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 3,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    expect(result.rows).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it('multipleChoice: 選出された行の qaaChoiceIndex が null', () => {
    const index = makeIndex(baseTestData(1));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    expect(result.rows[0]?.qaaChoiceIndex).toBeNull();
  });

  it('qaa 系: 選出行の qaaChoiceIndex が 1〜4 のいずれかになる（grade=1）', () => {
    const index = makeQaaIndex(1, baseTestData(1));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    const choiceIndex = result.rows[0]?.qaaChoiceIndex;
    expect(choiceIndex).not.toBeNull();
    expect([1, 2, 3, 4]).toContain(choiceIndex);
  });

  it('qaa 系: 同一 No の異なる choiceIndex が別エントリとして選出できる（CandidateEntry 単位の重複排除）', () => {
    // 1問に 4つの選択肢エントリ → 4スロット全て埋まる
    const index = makeQaaIndex(1, baseTestData(1));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 4,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    expect(result.rows).toHaveLength(4);
    // 全行の selectedNo が '1'
    expect(result.rows.every((r) => r.selectedNo === '1')).toBe(true);
    // 全行の choiceIndex が全て異なる
    const choiceIndices = result.rows.map((r) => r.qaaChoiceIndex);
    expect(new Set(choiceIndices).size).toBe(4);
  });

  it('難易度指定ありでは quota を満たせない枠を別難易度で埋めない', () => {
    const index = makeIndex(baseTestData(1, { difficult: '1' }));
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: {
        ...defaultDifficulty,
        isCalculated: true,
        entityCount: [0, 1, 0],
      },
    });

    expect(result.hasError).toBe(true);
    expect(result.rows[0]?.selectedNo).toBeNull();
    expect(result.rows[0]?.errorMessage).toContain('候補不足');
  });

  it('パス1: fixedChoiceIndex 非 null の固定スロットは No + choiceIndex 両方が確定する', () => {
    const index = makeQaaIndex(1, baseTestData(1));
    const fixedRow = {
      id: 'row-fixed',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '1',
      qaaChoiceIndex: 2, // fixedChoiceIndex=2
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [fixedRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    const fixed = result.rows.find((r) => r.isFixed);
    expect(fixed?.selectedNo).toBe('1');
    expect(fixed?.qaaChoiceIndex).toBe(2);
  });

  it('パス1で確定した (No, choiceIndex) は後続スロットから選出されない', () => {
    // no=1 の choiceIndex=2 が固定 → 残りスロットは choiceIndex=1,3,4 から
    const index = makeQaaIndex(1, baseTestData(1));
    const fixedRow = {
      id: 'row-fixed',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '1',
      qaaChoiceIndex: 2,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 2,
        },
      ],
      [fixedRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    const nonFixed = result.rows.filter((r) => !r.isFixed);
    expect(nonFixed[0]?.qaaChoiceIndex).not.toBe(2);
  });

  it('パス2: fixedChoiceIndex=null の固定スロットは No 固定・ choiceIndex 再抖り当て', () => {
    const index = makeQaaIndex(1, baseTestData(1));
    const fixedRow = {
      id: 'row-fixed',
      sourceConditionId: 'cond-1',
      categoryTable: [],
      selectedNo: '1',
      qaaChoiceIndex: null, // fixedChoiceIndex=null → パス2
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots(
      [
        {
          id: 'cond-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          count: 1,
        },
      ],
      [fixedRow],
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    const fixed = result.rows.find((r) => r.isFixed);
    // No は固定
    expect(fixed?.selectedNo).toBe('1');
    // choiceIndex は再抖り当てされ 1〜4 のいずれか
    expect(fixed?.qaaChoiceIndex).not.toBeNull();
    expect([1, 2, 3, 4]).toContain(fixed?.qaaChoiceIndex);
  });

  it('パス2: 有効選択肢が 0 件の場合 hasError=true になる', () => {
    // ch1〜ch4 が空 → qaaインデックスに no=1 のエントリがない
    const index = makeQaaIndex(
      1,
      baseTestData(1, { ch1: '', ch2: '', ch3: '', ch4: '' }),
    );
    const fixedRow = {
      id: 'row-fixed',
      sourceConditionId: 'orphan', // 存在しない条件ID → 孤立固定行
      categoryTable: [],
      selectedNo: '1',
      qaaChoiceIndex: null,
      isFixed: true,
      pageBreakBefore: false,
      hasError: false,
      errorMessage: null,
    };
    const slots = buildWorkbookDrawSlots([], [fixedRow]);
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    const fixed = result.rows.find((r) => r.isFixed);
    expect(fixed?.hasError).toBe(true);
    expect(fixed?.errorMessage).toContain('有効選択肢がありません');
  });

  it('Exam スロット: OR 条件が正しく解決される', () => {
    const index = buildCandidateIndex({
      testDataByNo: makeMap(
        baseTestData(1, {
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
        }),
        baseTestData(2, {
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-2',
        }),
      ),
      options: defaultOptions,
    });
    const slots = buildExamDrawSlots(
      [
        {
          id: 'frame-1',
          subject: '学科Ⅰ' as const,
          categoryConditions: [
            { big: '大分類A', small: '小分類A-1' },
            { big: '大分類A', small: '小分類A-2' },
          ],
        },
      ],
      [],
      1,
    );
    const result = runDrawEngine({
      slots,
      index,
      difficulty: defaultDifficulty,
    });
    expect(result.hasError).toBe(false);
    expect(['1', '2']).toContain(result.rows[0]?.selectedNo);
  });
});

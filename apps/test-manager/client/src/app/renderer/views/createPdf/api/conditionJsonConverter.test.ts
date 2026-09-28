import type { TestData } from '@shared/types/contracts';
import type {
  ExamConditionJson,
  WorkbookConditionJson,
} from '@shared/types/createPdfConditionJson';
import {
  buildExamConditionJson,
  buildWorkbookConditionJson,
  resolveConditionJsonToSnapshot,
} from '@views/createPdf/api/conditionJsonConverter';
import {
  createExamDrawConditionKey,
  createWorkbookDrawConditionKey,
} from '@views/createPdf/api/createPdfConditionKeys';
import {
  createInitialExamState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import { createWorkbookCategoryConditionId } from '@views/createPdf/api/workbookConditions';
import type { TestTableStoreSnapshot } from '@views/createPdf/types/testTable';
import { describe, expect, it } from 'vitest';

// ─── テスト用フィクスチャ ────────────────────────────────────────────────────────

const makeTestData = (overrides: Partial<TestData> = {}): TestData => ({
  id: 'test_1',
  no: 1,
  uuid: 'uuid-1',
  nengo: '令和',
  active: true,
  answerNumber: '1',
  answerText: '答え',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  ch1: '',
  ch2: '',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '⭐︎',
  grade: 1,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  testNo: '1',
  text: '問題文',
  themeTag: '',
  parentNo: 0,
  year: '5',
  subject: '学科Ⅰ',
  bigCategoryTag: '大分類A',
  smallCategoryTag: '小分類A',
  isOriginal: false,
  publicationYear: undefined,
  publicationNo: undefined,
  answer: '1',
  answerDescription: '',
  choices: [],
  questionText: '問題文',
  questionImages: [],
  tags: [],
  status: '準備完了',
  difficulty: 2,
  ...overrides,
});

const EMPTY_TABLE: TestTableStoreSnapshot = {
  sections: [],
  sectionMode: 'single',
  settings: { showQaaChoiceIndex: false },
  lastAppliedDrawConditionKey: null,
  lastSavedOrRestoredTableKey: null,
};

// ─── buildWorkbookConditionJson ──────────────────────────────────────────────

describe('buildWorkbookConditionJson', () => {
  it('selectedNo が null の行は selectedUuid/selectedReference が null になる', () => {
    const draft = createInitialWorkbookState();
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'single',
      sections: [
        {
          id: '1',
          label: '問題',
          rows: [
            {
              id: 'row_1',
              sourceConditionId: null,
              categoryTable: [],
              selectedNo: null,
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ],
        },
      ],
    };

    const result = buildWorkbookConditionJson(draft, table, new Map());
    expect(result.creationType).toBe('workbook');
    expect(result.table[0].selectedNo).toBeNull();
    expect(result.table[0].selectedUuid).toBeNull();
    expect(result.table[0].selectedReference).toBeNull();
  });

  it('selectedNo がある行は testDataByNo から UUID と参照情報を解決する', () => {
    const draft = createInitialWorkbookState();
    const testData = makeTestData({ no: 1, uuid: 'uuid-1' });
    const byNo = new Map([[1, testData]]);
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'single',
      sections: [
        {
          id: '1',
          label: '問題',
          rows: [
            {
              id: 'row_1',
              sourceConditionId: null,
              categoryTable: [],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ],
        },
      ],
    };

    const result = buildWorkbookConditionJson(draft, table, byNo);
    expect(result.table[0].selectedUuid).toBe('uuid-1');
    expect(result.table[0].selectedReference?.no).toBe('1');
    expect(result.table[0].selectedReference?.subject).toBe('学科Ⅰ');
  });

  it('問題テーブルの showQaaChoiceIndex を JSON に保存する', () => {
    const draft = createInitialWorkbookState();
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      settings: { showQaaChoiceIndex: true },
    };

    const result = buildWorkbookConditionJson(draft, table, new Map());

    expect(result.showQaaChoiceIndex).toBe(true);
  });
});

// ─── buildExamConditionJson ──────────────────────────────────────────────────

describe('buildExamConditionJson', () => {
  it('sections を学科ごとにフラットな slots に変換する', () => {
    const draft = createInitialExamState();
    const testData = makeTestData({
      no: 10,
      uuid: 'uuid-10',
      subject: '学科Ⅱ',
    });
    const byNo = new Map([[10, testData]]);
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'by-subject',
      sections: [
        {
          id: '学科Ⅱ',
          label: '学科Ⅱ',
          rows: [
            {
              id: 'slot_1',
              sourceConditionId: null,
              categoryTable: [
                {
                  id: 'cat_1',
                  subject: '学科Ⅱ',
                  bigCategoryTag: '大分類B',
                  smallCategoryTag: null,
                },
              ],
              selectedNo: '10',
              qaaChoiceIndex: null,
              isFixed: true,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ],
        },
      ],
    };

    const result = buildExamConditionJson(draft, table, byNo);
    expect(result.creationType).toBe('exam');
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].subject).toBe('学科Ⅱ');
    expect(result.slots[0].selectedUuid).toBe('uuid-10');
    expect(result.slots[0].categoryPairs[0].big).toBe('大分類B');
    expect(result.slots[0].isFixed).toBe(true);
  });

  it('selectedNo が null の slots は selectedUuid が null', () => {
    const draft = createInitialExamState();
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'by-subject',
      sections: [
        {
          id: '学科Ⅰ',
          label: '学科Ⅰ',
          rows: [
            {
              id: 'slot_2',
              sourceConditionId: null,
              categoryTable: [],
              selectedNo: null,
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ],
        },
      ],
    };

    const result = buildExamConditionJson(draft, table, new Map());
    expect(result.slots[0].selectedUuid).toBeNull();
    expect(result.slots[0].selectedReference).toBeNull();
  });

  it('問題テーブルの showQaaChoiceIndex を exam JSON に保存する', () => {
    const draft = createInitialExamState();
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'by-subject',
      settings: { showQaaChoiceIndex: true },
    };

    const result = buildExamConditionJson(draft, table, new Map());

    expect(result.showQaaChoiceIndex).toBe(true);
  });

  it('実施年月日を exam JSON に保存する', () => {
    const draft = {
      ...createInitialExamState(),
      stepThree: {
        ...createInitialExamState().stepThree,
        examDate: { year: '2026', month: '', day: '1' },
      },
    };
    const table: TestTableStoreSnapshot = {
      ...EMPTY_TABLE,
      sectionMode: 'by-subject',
    };

    const result = buildExamConditionJson(draft, table, new Map());

    expect(result.examDate).toEqual({ year: '2026', month: '', day: '1' });
  });
});

// ─── resolveConditionJsonToSnapshot ─────────────────────────────────────────

describe('resolveConditionJsonToSnapshot', () => {
  const makeWorkbookJson = (
    overrides: Partial<WorkbookConditionJson> = {},
  ): WorkbookConditionJson => ({
    version: 1,
    creationType: 'workbook',
    gradeId: 1,
    title: 'テスト',
    createdAt: '2024-01-01T00:00:00.000Z',
    shuffleSeed: null,
    mode: 'qaa',
    excludedTagIds: [],
    excludePastExam: false,
    excludeOriginal: false,
    isChoiceShuffle: false,
    difficulty: { isEnabled: false, ratios: [30, 70] },
    conditions: [],
    table: [],
    ...overrides,
  });

  it('workbook JSON から WorkbookState と testTable を復元する', () => {
    const json = makeWorkbookJson({
      title: '復元タイトル',
      gradeId: 2,
    });
    const { snapshot, adjustedRows } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );
    expect(snapshot.workbook?.basic.title).toBe('復元タイトル');
    expect(snapshot.workbook?.basic.grade).toBe(2);
    expect(snapshot.testTable?.sectionMode).toBe('single');
    expect(snapshot.testTable?.sections[0]?.subject).toBe('学科Ⅰ');
    expect(adjustedRows).toHaveLength(0);
  });

  it('workbook JSON の showQaaChoiceIndex がある場合は snapshot に反映する', () => {
    const json = makeWorkbookJson({
      mode: 'qaa',
      showQaaChoiceIndex: false,
    });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.settings.showQaaChoiceIndex).toBe(false);
  });

  it('旧 workbook JSON は qaa 系 mode から showQaaChoiceIndex を補完する', () => {
    const json = makeWorkbookJson({ mode: 'qaaAllTrue' });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.settings.showQaaChoiceIndex).toBe(true);
  });

  it('旧 workbook JSON は multipleChoice mode の場合 showQaaChoiceIndex=false に補完する', () => {
    const json = makeWorkbookJson({ mode: 'multipleChoice' });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.settings.showQaaChoiceIndex).toBe(false);
  });

  it('workbook JSON 復元時に有効条件IDと全 table 行の sourceConditionId を安定IDへ変換する', () => {
    const stableId = createWorkbookCategoryConditionId({
      subject: '学科Ⅰ',
      bigCategoryTag: '大分類A',
      smallCategoryTag: '小分類A',
    });
    const json = makeWorkbookJson({
      conditions: [
        {
          id: 'random-condition-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A',
          count: 2,
        },
      ],
      table: [
        {
          id: 'row_fixed',
          sourceConditionId: 'random-condition-1',
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: true,
          pageBreakBefore: false,
        },
        {
          id: 'row_unfixed',
          sourceConditionId: 'random-condition-1',
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.workbook?.stepTwo.categoryTable).toEqual([
      {
        id: stableId,
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A',
        count: 2,
      },
    ]);
    expect(
      snapshot.testTable?.sections[0].rows.map((row) => row.sourceConditionId),
    ).toEqual([stableId, stableId]);
    expect(snapshot.testTable?.sections[0].subject).toBe('学科Ⅰ');
  });

  it('workbook JSON 復元時に同一カテゴリ条件を初出順で統合し count を合算する', () => {
    const stableA = createWorkbookCategoryConditionId({
      subject: '学科Ⅰ',
      bigCategoryTag: '大分類A',
      smallCategoryTag: '小分類A',
    });
    const stableB = createWorkbookCategoryConditionId({
      subject: '学科Ⅱ',
      bigCategoryTag: '大分類B',
      smallCategoryTag: null,
    });
    const json = makeWorkbookJson({
      conditions: [
        {
          id: 'cond-a-1',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A',
          count: 2,
        },
        {
          id: 'cond-b-1',
          subject: '学科Ⅱ',
          bigCategoryTag: '大分類B',
          smallCategoryTag: null,
          count: 4,
        },
        {
          id: 'cond-a-2',
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A',
          count: 3,
        },
      ],
      table: [
        {
          id: 'row_a1',
          sourceConditionId: 'cond-a-1',
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
        {
          id: 'row_b1',
          sourceConditionId: 'cond-b-1',
          categoryPairs: [{ big: '大分類B', small: null }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
        {
          id: 'row_a2',
          sourceConditionId: 'cond-a-2',
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.workbook?.stepTwo.categoryTable).toEqual([
      {
        id: stableA,
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A',
        count: 5,
      },
      {
        id: stableB,
        subject: '学科Ⅱ',
        bigCategoryTag: '大分類B',
        smallCategoryTag: null,
        count: 4,
      },
    ]);
    expect(
      snapshot.testTable?.sections[0].rows.map((row) => ({
        id: row.id,
        sourceConditionId: row.sourceConditionId,
      })),
    ).toEqual([
      { id: 'row_a1', sourceConditionId: stableA },
      { id: 'row_b1', sourceConditionId: stableB },
      { id: 'row_a2', sourceConditionId: stableA },
    ]);
  });

  it('workbook JSON 復元時に不完全条件は復元せず sourceConditionId の推定補完もしない', () => {
    const json = makeWorkbookJson({
      conditions: [
        {
          id: 'incomplete-condition',
          subject: null,
          bigCategoryTag: null,
          smallCategoryTag: '小分類A',
          count: 1,
        },
      ],
      table: [
        {
          id: 'row_incomplete',
          sourceConditionId: 'incomplete-condition',
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
        {
          id: 'row_null',
          sourceConditionId: null,
          categoryPairs: [{ big: '大分類A', small: '小分類A' }],
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.workbook?.stepTwo.categoryTable).toEqual([]);
    expect(
      snapshot.testTable?.sections[0].rows.map((row) => row.sourceConditionId),
    ).toEqual(['incomplete-condition', null]);
  });

  it('UUID と参照が一致する行は adjustedRows に含まれない', () => {
    const testData = makeTestData({ no: 5, uuid: 'uuid-5' });
    const byNo = new Map([[5, testData]]);
    const byUuid = new Map([['uuid-5', testData]]);
    const json = makeWorkbookJson({
      table: [
        {
          id: 'row_1',
          sourceConditionId: null,
          categoryPairs: [],
          selectedNo: '5',
          selectedUuid: 'uuid-5',
          selectedReference: {
            nengo: '令和',
            year: '5',
            subject: '学科Ⅰ',
            no: '5',
            isOriginal: false,
            publicationYear: null,
            publicationNo: null,
          },
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { adjustedRows } = resolveConditionJsonToSnapshot(json, byNo, byUuid);
    expect(adjustedRows).toHaveLength(0);
  });

  it('UUID が存在しない行は adjustedRows に reason: cleared が追加される', () => {
    const json = makeWorkbookJson({
      table: [
        {
          id: 'row_1',
          sourceConditionId: null,
          categoryPairs: [],
          selectedNo: '99',
          selectedUuid: 'uuid-nonexistent',
          selectedReference: null,
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { adjustedRows, snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );
    expect(adjustedRows).toHaveLength(1);
    expect(adjustedRows[0].reason).toBe('cleared');
    expect(snapshot.testTable?.sections[0].rows[0].selectedNo).toBeNull();
  });

  it('exam JSON から ExamState と by-subject testTable を復元する', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      slots: [
        {
          id: 'slot_1',
          subject: '学科Ⅲ',
          categoryPairs: [],
          isFixed: false,
          pageBreakBefore: false,
          selectedNo: null,
          selectedUuid: null,
          selectedReference: null,
        },
      ],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );
    expect(snapshot.testTable?.sectionMode).toBe('by-subject');
    expect(snapshot.testTable?.sections[0].id).toBe('学科Ⅲ');
    expect(snapshot.testTable?.sections[0].subject).toBe('学科Ⅲ');
    expect(snapshot.testTable?.sections[0].rows[0].sourceConditionId).toBe(
      'restored_slot_1',
    );
    expect(snapshot.exam?.stepTwo.categoryTable[0]?.id).toBe('restored_slot_1');
    expect(snapshot.exam?.basic.title).toBe('模擬試験');
  });

  it('exam JSON の showQaaChoiceIndex がある場合は snapshot に反映する', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      showQaaChoiceIndex: true,
      slots: [],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.settings.showQaaChoiceIndex).toBe(true);
  });

  it('旧 exam JSON は showQaaChoiceIndex=false に補完する', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      slots: [],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.settings.showQaaChoiceIndex).toBe(false);
  });

  it('exam JSON の実施年月日を復元する', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      examDate: { year: '2026', month: '', day: '1' },
      slots: [],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.exam?.stepThree.examDate).toEqual({
      year: '2026',
      month: '',
      day: '1',
    });
  });

  it('旧 exam JSON は実施年月日を空文字に補完する', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      slots: [],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.exam?.stepThree.examDate).toEqual({
      year: '',
      month: '',
      day: '',
    });
  });

  // ── lastSavedOrRestoredTableKey ──────────────────────────────────────────

  it('workbook restore 後に testTable.lastSavedOrRestoredTableKey が sections のキーに設定される', () => {
    const testData = makeTestData({ no: 1, uuid: 'uuid-1' });
    const byNo = new Map([[1, testData]]);
    const byUuid = new Map([['uuid-1', testData]]);
    const json = makeWorkbookJson({
      table: [
        {
          id: 'row_1',
          sourceConditionId: null,
          categoryPairs: [],
          selectedNo: '1',
          selectedUuid: 'uuid-1',
          selectedReference: {
            nengo: '令和',
            year: '5',
            subject: '学科Ⅰ',
            no: '1',
            isOriginal: false,
            publicationYear: null,
            publicationNo: null,
          },
          qaaChoiceIndex: null,
          isFixed: false,
          pageBreakBefore: false,
        },
      ],
    });

    const { snapshot } = resolveConditionJsonToSnapshot(json, byNo, byUuid);
    const { testTable } = snapshot;
    // restore後に applyDrawResult と同等のキーが設定されていることで hasUnsavedTableChanges = false になる
    expect(testTable?.lastSavedOrRestoredTableKey).toBe(
      JSON.stringify(testTable?.sections),
    );
  });

  it('workbook restore 後に testTable.lastAppliedDrawConditionKey が復元後の抽選条件キーに設定される', () => {
    const json = makeWorkbookJson({ table: [] });
    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.lastAppliedDrawConditionKey).toBe(
      createWorkbookDrawConditionKey({
        basic: snapshot.workbook!.basic,
        stepTwo: snapshot.workbook!.stepTwo,
      }),
    );
  });

  it('workbook restore で table が空の場合も lastSavedOrRestoredTableKey が sections のキーに設定される', () => {
    const json = makeWorkbookJson({ table: [] });
    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );
    const { testTable } = snapshot;
    expect(testTable?.lastSavedOrRestoredTableKey).toBe(
      JSON.stringify(testTable?.sections),
    );
  });

  it('exam restore 後に testTable.lastSavedOrRestoredTableKey が sections のキーに設定される', () => {
    const testData = makeTestData({ no: 1, uuid: 'uuid-1', subject: '学科Ⅰ' });
    const byNo = new Map([[1, testData]]);
    const byUuid = new Map([['uuid-1', testData]]);
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      slots: [
        {
          id: 'slot_1',
          subject: '学科Ⅰ',
          categoryPairs: [],
          isFixed: false,
          pageBreakBefore: false,
          selectedNo: '1',
          selectedUuid: 'uuid-1',
          selectedReference: {
            nengo: '令和',
            year: '5',
            subject: '学科Ⅰ',
            no: '1',
            isOriginal: false,
            publicationYear: null,
            publicationNo: null,
          },
        },
      ],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(json, byNo, byUuid);
    const { testTable } = snapshot;
    expect(testTable?.lastSavedOrRestoredTableKey).toBe(
      JSON.stringify(testTable?.sections),
    );
  });

  it('exam restore 後に testTable.lastAppliedDrawConditionKey が復元後の抽選条件キーに設定される', () => {
    const json: ExamConditionJson = {
      version: 1,
      creationType: 'exam',
      gradeId: 1,
      title: '模擬試験',
      createdAt: '2024-01-01T00:00:00.000Z',
      shuffleSeed: null,
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: false,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      slots: [],
    };

    const { snapshot } = resolveConditionJsonToSnapshot(
      json,
      new Map(),
      new Map(),
    );

    expect(snapshot.testTable?.lastAppliedDrawConditionKey).toBe(
      createExamDrawConditionKey({
        basic: snapshot.exam!.basic,
        stepTwo: snapshot.exam!.stepTwo,
      }),
    );
  });
});

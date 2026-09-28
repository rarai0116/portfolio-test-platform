import type { TestData } from '@shared/types/contracts';
import type { WorkbookConditionJson } from '@shared/types/createPdfConditionJson';
import type { CreatePdfTestCategoryResourceState } from '@views/createPdf/store/useCreatePdfResourceStore';
import { createEmptyCreatePdfBigKeysBySubject } from '@views/createPdf/store/useCreatePdfResourceStore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLoadedConditionJson } from './conditionJsonImportResolver';
import {
  buildLegacyTestDataReferenceMap,
  buildReferenceKeyFromSelectedReference,
} from './conditionJsonReference';

const makeTestData = (overrides: Partial<TestData> = {}): TestData => ({
  id: 'test_101',
  no: 101,
  uuid: 'uuid-101',
  nengo: '令和',
  active: true,
  answerNumber: '1',
  answerText: '答え',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  ch1: '選択肢1',
  ch2: '選択肢2',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '2',
  grade: 1,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  testNo: '10',
  text: '問題文',
  themeTag: '',
  parentNo: 0,
  year: '6',
  subject: '学科Ⅰ',
  bigCategoryTag: '現行大',
  smallCategoryTag: '現行小',
  isOriginal: false,
  publicationYear: '2024',
  publicationNo: '7',
  status: '準備完了',
  ...overrides,
});

const makeCategoryState = (): CreatePdfTestCategoryResourceState => {
  const bigKeysBySubject = createEmptyCreatePdfBigKeysBySubject();
  bigKeysBySubject.学科Ⅰ = ['計画原論'];

  return {
    grade: 1,
    bigKeysBySubject,
    smallKeysBySubjectAndBig: {
      '学科Ⅰ::計画原論': ['気候・空気'],
    },
    isLoading: false,
  };
};

describe('conditionJsonReference', () => {
  it('旧JSONの testNo / 0始まり publicationNo で現行 TestData を照合できる', () => {
    const data = makeTestData();
    const map = buildLegacyTestDataReferenceMap(new Map([[data.no, data]]));
    const legacyKey = buildReferenceKeyFromSelectedReference({
      nengo: '令和',
      year: '6',
      subject: '学科Ⅰ',
      no: '10',
      isOriginal: false,
      publicationYear: '2024',
      publicationNo: '007',
    });

    expect(map.get(legacyKey)).toBe(data);
  });

  it('DB側の publicationNo が0始まりでも旧JSONの publicationNo と照合できる', () => {
    const data = makeTestData({ publicationNo: '007' });
    const map = buildLegacyTestDataReferenceMap(new Map([[data.no, data]]));
    const legacyKey = buildReferenceKeyFromSelectedReference({
      nengo: '令和',
      year: '6',
      subject: '学科Ⅰ',
      no: '10',
      isOriginal: false,
      publicationYear: '2024',
      publicationNo: '7',
    });

    expect(map.get(legacyKey)).toBe(data);
  });

  it('旧JSON照合では旧JSON testNo と現DB no が同じでも現DB testNo が違えば一致しない', () => {
    const data = makeTestData({ no: 10, testNo: '99' });
    const map = buildLegacyTestDataReferenceMap(new Map([[data.no, data]]));
    const legacyKey = buildReferenceKeyFromSelectedReference({
      nengo: '令和',
      year: '6',
      subject: '学科Ⅰ',
      no: '10',
      isOriginal: false,
      publicationYear: '2024',
      publicationNo: '007',
    });

    expect(map.get(legacyKey)).toBeUndefined();
  });
});

describe('resolveLoadedConditionJson', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('本アプリ用JSONは形式判定サマリを付けてそのまま返す', async () => {
    const json: WorkbookConditionJson = {
      version: 1,
      creationType: 'workbook',
      gradeId: 1,
      title: '現行JSON',
      createdAt: '2026-01-01T00:00:00.000Z',
      shuffleSeed: 1,
      mode: 'qaa',
      excludedTagIds: [],
      excludePastExam: false,
      excludeOriginal: false,
      isChoiceShuffle: true,
      difficulty: { isEnabled: false, ratios: [30, 70] },
      selectedYears: null,
      conditions: [],
      table: [],
    };

    const result = await resolveLoadedConditionJson(json, {
      testDataByNo: new Map(),
      testCategory: makeCategoryState(),
    });

    expect(result.json).toBe(json);
    expect(result.importSummary).toMatchObject({
      sourceType: 'current-workbook',
      inputRowCount: 0,
      convertedRowCount: 0,
    });
  });

  it('旧一問一答JSONを問題集JSONへ変換し、照合不能行は既存カテゴリで空白行にする', async () => {
    const data = makeTestData();
    const otherYearData = makeTestData({
      no: 102,
      uuid: 'uuid-102',
      testNo: '99',
      year: '5',
      publicationNo: '99',
    });
    const result = await resolveLoadedConditionJson(
      {
        testName: '旧アプリ問題集',
        testMode: 'mode-qaa-normal',
        lists: [
          [
            {
              grade: 0,
              sublect: '学科Ⅰ',
              nengo: '令和',
              year: '6',
              testNo: '10',
              parentbNo: '2024_学科Ⅰ_007',
              tagA: '未使用',
              tagB: '未使用',
            },
            {
              grade: 0,
              sublect: '学科Ⅰ',
              nengo: '令和',
              year: '6',
              testNo: '999',
              parentbNo: '2024_学科Ⅰ_999',
              tagA: '計画原論',
              tagB: '気候・空気',
            },
            {
              grade: 0,
              sublect: '学科Ⅱ',
              testNo: '11',
              tagA: '計画原論',
              tagB: '気候・空気',
            },
            {
              grade: 0,
              sublect: '学科Ⅰ',
              testNo: '12',
              tagA: '存在しない大',
              tagB: '存在しない小',
            },
          ],
        ],
      },
      {
        testDataByNo: new Map([
          [data.no, data],
          [otherYearData.no, otherYearData],
        ]),
        testCategory: makeCategoryState(),
      },
    );

    expect(result.importSummary).toMatchObject({
      sourceType: 'legacy-qaa-workbook',
      inputRowCount: 4,
      convertedRowCount: 2,
      skippedRowCount: 1,
      subjectMismatchRowCount: 1,
      blankedRowCount: 0,
    });

    expect(result.json.creationType).toBe('workbook');
    if (result.json.creationType !== 'workbook') return;

    expect(result.json.gradeId).toBe(1);
    expect(result.json.title).toBe('旧アプリ問題集');
    expect(result.json.mode).toBe('qaa');
    expect(result.json.selectedYears).toEqual(['令和6', '令和5']);
    expect(result.json.isChoiceShuffle).toBe(true);
    expect(result.json.shuffleSeed).not.toBeNull();
    expect(result.json.table).toHaveLength(2);
    expect(result.json.table[0]).toMatchObject({
      selectedNo: '101',
      selectedUuid: 'uuid-101',
      isFixed: false,
    });
    expect(result.json.table[0].qaaChoiceIndex).not.toBeNull();
    expect(result.json.table[1]).toMatchObject({
      selectedNo: null,
      selectedUuid: null,
      qaaChoiceIndex: null,
      isFixed: false,
      categoryPairs: [{ big: '計画原論', small: '気候・空気' }],
    });
    expect(console.log).toHaveBeenCalledWith(
      '[createPdf:legacyJsonImport] problem no unresolved',
      expect.objectContaining({
        rowId: 'legacy-row-2',
        reason: 'reference_not_matched',
      }),
    );
  });

  it('qaaChoiceIndex候補が同一問題で枯渇した行は空白行に落とす', async () => {
    const data = makeTestData({ ch2: '' });
    const row = {
      grade: 0,
      sublect: '学科Ⅰ',
      nengo: '令和',
      year: '6',
      testNo: '10',
      parentbNo: '2024_学科Ⅰ_007',
    };

    const result = await resolveLoadedConditionJson(
      {
        testName: '重複候補',
        testMode: 'mode-qaa-normal',
        optionSetting: { isChoiceShuffle: false },
        lists: [[row, row]],
      },
      {
        testDataByNo: new Map([[data.no, data]]),
        testCategory: makeCategoryState(),
      },
    );

    expect(result.importSummary.blankedRowCount).toBe(1);
    expect(result.json.creationType).toBe('workbook');
    if (result.json.creationType !== 'workbook') return;
    expect(result.json.gradeId).toBe(1);
    expect(result.json.shuffleSeed).toBeNull();
    expect(result.json.table[0].selectedNo).toBe('101');
    expect(result.json.table[0].isFixed).toBe(false);
    expect(result.json.table[1]).toMatchObject({
      selectedNo: null,
      selectedUuid: null,
      selectedReference: null,
      qaaChoiceIndex: null,
      isFixed: false,
    });
    expect(console.log).toHaveBeenCalledWith(
      '[createPdf:legacyJsonImport] problem no unresolved',
      expect.objectContaining({
        rowId: 'legacy-row-2',
        reason: 'qaa_choice_candidate_exhausted',
      }),
    );
  });

  it('旧JSONの通常選択式モードを multipleChoice として復元する', async () => {
    const data = makeTestData({ isConvertibleQaa: false });

    const result = await resolveLoadedConditionJson(
      {
        testName: '通常選択式',
        testMode: 'mode-choices-normal',
        optionSetting: { isChoiceShuffle: true },
        lists: [
          [
            {
              grade: 0,
              sublect: '学科Ⅰ',
              nengo: '令和',
              year: '6',
              testNo: '10',
              parentbNo: '2024_学科Ⅰ_007',
            },
          ],
        ],
      },
      {
        testDataByNo: new Map([[data.no, data]]),
        testCategory: makeCategoryState(),
      },
    );

    expect(result.importSummary.blankedRowCount).toBe(0);
    expect(result.json.creationType).toBe('workbook');
    if (result.json.creationType !== 'workbook') return;
    expect(result.json.mode).toBe('multipleChoice');
    expect(result.json.showQaaChoiceIndex).toBe(false);
    expect(result.json.table[0]).toMatchObject({
      selectedNo: '101',
      selectedUuid: 'uuid-101',
      qaaChoiceIndex: null,
      isFixed: false,
    });
  });

  it('旧JSONの全て○/全て×モードを復元し、answerBoolに合う選択肢だけを割り当てる', async () => {
    const data = makeTestData({
      ch1: '正答選択肢',
      ch2: '誤答選択肢',
      answerNumber: '1',
      isNegativeAnswer: false,
    });
    const row = {
      grade: 0,
      sublect: '学科Ⅰ',
      nengo: '令和',
      year: '6',
      testNo: '10',
      parentbNo: '2024_学科Ⅰ_007',
    };

    const trueResult = await resolveLoadedConditionJson(
      {
        testName: '全て○',
        testMode: 'mode-qaa-all-correct',
        lists: [[row]],
      },
      {
        testDataByNo: new Map([[data.no, data]]),
        testCategory: makeCategoryState(),
      },
    );
    const falseResult = await resolveLoadedConditionJson(
      {
        testName: '全て×',
        testMode: 'mode-qaa-all-incorrect',
        lists: [[row]],
      },
      {
        testDataByNo: new Map([[data.no, data]]),
        testCategory: makeCategoryState(),
      },
    );

    expect(trueResult.json.creationType).toBe('workbook');
    expect(falseResult.json.creationType).toBe('workbook');
    if (
      trueResult.json.creationType !== 'workbook' ||
      falseResult.json.creationType !== 'workbook'
    ) {
      return;
    }

    expect(trueResult.json.mode).toBe('qaaAllTrue');
    expect(trueResult.json.gradeId).toBe(1);
    expect(trueResult.json.table[0].qaaChoiceIndex).toBe(1);
    expect(falseResult.json.mode).toBe('qaaAllFalse');
    expect(falseResult.json.gradeId).toBe(1);
    expect(falseResult.json.table[0].qaaChoiceIndex).toBe(2);
  });

  it('旧JSONの grade:1 は本アプリの2級として扱う', async () => {
    const data = makeTestData({
      grade: 2,
      no: 202,
      uuid: 'uuid-202',
      subject: '学科Ⅰ',
      testNo: '20',
      publicationYear: '2024',
      publicationNo: '20',
      ch5: '2級用選択肢',
    });

    const result = await resolveLoadedConditionJson(
      {
        testName: '旧アプリ2級',
        testMode: 'mode-qaa-normal',
        lists: [
          [
            {
              grade: 1,
              sublect: '学科Ⅰ',
              nengo: '令和',
              year: '6',
              testNo: '20',
              parentbNo: '2024_学科Ⅰ_020',
            },
          ],
        ],
      },
      {
        testDataByNo: new Map([[data.no, data]]),
        testCategory: {
          ...makeCategoryState(),
          grade: 2,
        },
      },
    );

    expect(result.json.creationType).toBe('workbook');
    if (result.json.creationType !== 'workbook') return;
    expect(result.json.gradeId).toBe(2);
    expect(result.json.table[0]).toMatchObject({
      selectedNo: '202',
      selectedUuid: 'uuid-202',
      isFixed: false,
    });
  });
});

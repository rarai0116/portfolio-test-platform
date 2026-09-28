import type { TestData } from '@shared/types/contracts';
import { buildCandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type { CreatePdfCommonOptionDraftState } from '@views/createPdf/types/draftState';
import type { CreatePdfTestTableCheckSnapshot } from '@views/createPdf/types/statusState';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import { describe, expect, it } from 'vitest';
import { deriveCreatePdfDrawStatus } from './createPdfDrawStatus';

const baseOptions: CreatePdfCommonOptionDraftState = {
  excludedTagIds: [],
  excludePastExam: false,
  excludeOriginal: false,
  isShuffleChoices: false,
  shuffleSeed: null,
};

const emptyChecks: CreatePdfTestTableCheckSnapshot = {
  blankRows: [],
  invalidNoRows: [],
  invalidChoiceRows: [],
  qaaChoiceMissingRows: [],
  duplicateRows: [],
  orphanFixedRows: [],
  subjectMismatchRows: [],
};

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
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 1,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: '令和',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '6',
  ...overrides,
});

const createSlot = (overrides: Partial<DrawSlot> = {}): DrawSlot => ({
  id: 'slot-1',
  sourceConditionId: 'cond-1',
  subject: '学科Ⅰ',
  conditions: [{ big: '大分類A', small: '小分類A-1' }],
  fixedNo: null,
  fixedChoiceIndex: null,
  ...overrides,
});

const createFixedRow = (
  id: string,
  selectedNo: string,
  sourceConditionId = 'cond-1',
): TestTableRow => ({
  id,
  sourceConditionId,
  categoryTable: [],
  selectedNo,
  qaaChoiceIndex: null,
  isFixed: true,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
});

const buildIndex = (testData: readonly TestData[]) =>
  buildCandidateIndex({
    testDataByNo: new Map(testData.map((data) => [data.no, data])),
    options: baseOptions,
  });

describe('deriveCreatePdfDrawStatus', () => {
  it('条件ごとの固定行数が指定数を超えたら抽選不可にする', () => {
    const status = deriveCreatePdfDrawStatus({
      hasCategoryConditions: true,
      candidateIndex: buildIndex([baseTestData(1), baseTestData(2)]),
      testTableChecks: emptyChecks,
      slots: [],
      fixedRows: [
        createFixedRow('fixed-1', '1'),
        createFixedRow('fixed-2', '2'),
      ],
      conditionRequirements: new Map([['cond-1', 1]]),
      isBfsCalculating: false,
    });

    expect(status.canDraw).toBe(false);
    expect(status.blockingReasons.map((reason) => reason.code)).toContain(
      'draw-fixed-count-exceeded',
    );
  });

  it('カテゴリ候補数が指定数を下回ったら抽選不可にする', () => {
    const status = deriveCreatePdfDrawStatus({
      hasCategoryConditions: true,
      candidateIndex: buildIndex([baseTestData(1)]),
      testTableChecks: emptyChecks,
      slots: [createSlot({ id: 'slot-1' }), createSlot({ id: 'slot-2' })],
      fixedRows: [],
      conditionRequirements: new Map([['cond-1', 2]]),
      isBfsCalculating: false,
    });

    expect(status.canDraw).toBe(false);
    expect(status.blockingReasons.map((reason) => reason.code)).toContain(
      'draw-candidate-empty',
    );
  });

  it('抽選準備中は抽選不可にし、待機メッセージを先頭に出す', () => {
    const status = deriveCreatePdfDrawStatus({
      hasCategoryConditions: true,
      candidateIndex: buildIndex([baseTestData(1), baseTestData(2)]),
      testTableChecks: emptyChecks,
      slots: [createSlot({ id: 'slot-1' })],
      fixedRows: [],
      conditionRequirements: new Map([['cond-1', 1]]),
      isBfsCalculating: true,
    });

    expect(status.canDraw).toBe(false);
    expect(status.blockingReasons[0]).toMatchObject({
      code: 'draw-bfs-calculating',
      severity: 'blocking',
      message: '抽選準備中です。しばらくお待ちください',
    });
  });
});

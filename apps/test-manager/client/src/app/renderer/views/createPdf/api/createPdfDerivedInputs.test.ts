import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import {
  deriveActiveConditionIds,
  deriveCreatePdfCandidateIndex,
  deriveCreatePdfTestTableChecksCached,
  deriveSelectedYearNos,
  deriveYearFilterOptions,
  filterTestDataBySelectedYears,
} from './createPdfDerivedInputs';

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

const options = {
  excludedTagIds: [],
  excludePastExam: false,
  excludeOriginal: false,
  isShuffleChoices: false,
  shuffleSeed: null,
};

describe('createPdfDerivedInputs', () => {
  it('同じ問題データ参照では年フィルタ選択肢を再利用する', () => {
    const testDataByNo = new Map([
      [1, baseTestData(1, { nengo: '令和', year: '6' })],
      [2, baseTestData(2, { nengo: '令和', year: '5' })],
    ]);

    const optionsA = deriveYearFilterOptions(testDataByNo);
    const optionsB = deriveYearFilterOptions(testDataByNo);

    expect(optionsA).toBe(optionsB);
    expect(optionsA.nosMap).toBe(optionsB.nosMap);
    expect(optionsA.sortedLabels).toBe(optionsB.sortedLabels);
    expect(optionsA.sortedLabels).toEqual(['令和6', '令和5']);
  });

  it('同じ入力参照では year / filter / candidateIndex を再利用する', () => {
    const selectedYears = ['令和6'];
    const testDataByNo = new Map([
      [1, baseTestData(1)],
      [2, baseTestData(2, { year: '5' })],
    ]);

    const selectedYearNosA = deriveSelectedYearNos(testDataByNo, selectedYears);
    const selectedYearNosB = deriveSelectedYearNos(testDataByNo, selectedYears);
    expect(selectedYearNosA).toBe(selectedYearNosB);

    const filteredA = filterTestDataBySelectedYears(
      testDataByNo,
      selectedYearNosA,
    );
    const filteredB = filterTestDataBySelectedYears(
      testDataByNo,
      selectedYearNosB,
    );
    expect(filteredA).toBe(filteredB);

    const indexA = deriveCreatePdfCandidateIndex({
      filteredTestDataByNo: filteredA,
      allTestDataByNo: testDataByNo,
      fixedTestDataByNo: testDataByNo,
      options,
    });
    const indexB = deriveCreatePdfCandidateIndex({
      filteredTestDataByNo: filteredB,
      allTestDataByNo: testDataByNo,
      fixedTestDataByNo: testDataByNo,
      options,
    });

    expect(indexA).toBe(indexB);
  });

  it('同じ入力参照では activeConditionIds と testTableChecks を再利用する', () => {
    const categoryTable = [{ id: 'condition-1' }];
    const sections = [
      {
        id: 'section-1',
        label: '学科Ⅰ',
        rows: [
          {
            id: 'row-1',
            sourceConditionId: 'condition-1',
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
    ];
    const testDataByNo = new Map([[1, baseTestData(1)]]);

    const activeConditionIdsA = deriveActiveConditionIds(categoryTable);
    const activeConditionIdsB = deriveActiveConditionIds(categoryTable);
    expect(activeConditionIdsA).toBe(activeConditionIdsB);

    const checksA = deriveCreatePdfTestTableChecksCached({
      sections,
      testDataByNo,
      showQaaChoiceIndex: false,
      sectionMode: 'single',
      activeConditionIds: activeConditionIdsA,
    });
    const checksB = deriveCreatePdfTestTableChecksCached({
      sections,
      testDataByNo,
      showQaaChoiceIndex: false,
      sectionMode: 'single',
      activeConditionIds: activeConditionIdsB,
    });

    expect(checksA).toBe(checksB);
  });
});

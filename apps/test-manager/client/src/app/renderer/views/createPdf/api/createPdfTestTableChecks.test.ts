import type { TestData } from '@shared/types/contracts';
import type { TestTableSection } from '@views/createPdf/types/testTable';
import { describe, expect, it } from 'vitest';
import {
  deriveCreatePdfTestTableChecks,
  getBlockingTestTableReasons,
  getDrawBlockingTestTableReasons,
} from './createPdfTestTableChecks';

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

const makeSection = (rows: TestTableSection['rows']): TestTableSection => ({
  id: 'section-1',
  label: '学科Ⅰ',
  subject: '学科Ⅰ',
  rows,
});

describe('deriveCreatePdfTestTableChecks', () => {
  it('空白行・不正No・qaa選択肢未確定・不正choice・重複を分類する', () => {
    const testDataByNo = new Map([[1, baseTestData(1)]]);
    const checks = deriveCreatePdfTestTableChecks({
      sections: [
        makeSection([
          {
            id: 'blank',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: null,
            qaaChoiceIndex: null,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
          {
            id: 'missing-choice',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: '1',
            qaaChoiceIndex: null,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
          {
            id: 'invalid-choice',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: '1',
            qaaChoiceIndex: 3,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
          {
            id: 'duplicate-a',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: '1',
            qaaChoiceIndex: 1,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
          {
            id: 'duplicate-b',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: '1',
            qaaChoiceIndex: 1,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
          {
            id: 'invalid-no',
            sourceConditionId: 'cond-1',
            categoryTable: [],
            selectedNo: '999',
            qaaChoiceIndex: 1,
            isFixed: false,
            pageBreakBefore: false,
            hasError: false,
            errorMessage: null,
          },
        ]),
      ],
      testDataByNo,
      showQaaChoiceIndex: true,
      grade: 1,
      sectionMode: 'single',
    });

    expect(checks.blankRows).toHaveLength(1);
    expect(checks.qaaChoiceMissingRows).toHaveLength(1);
    expect(checks.invalidChoiceRows).toHaveLength(1);
    expect(checks.duplicateRows).toHaveLength(2);
    expect(checks.invalidNoRows).toHaveLength(1);
  });

  describe('学科対象外チェック', () => {
    it('行の想定学科と実データの学科が一致しない場合はblockingで検出する', () => {
      const testDataByNo = new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]);
      const checks = deriveCreatePdfTestTableChecks({
        sections: [
          makeSection([
            {
              id: 'mismatch',
              sourceConditionId: 'cond-1',
              categoryTable: [
                {
                  id: 'cat-1',
                  subject: '学科Ⅰ',
                  bigCategoryTag: null,
                  smallCategoryTag: null,
                },
              ],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ]),
        ],
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'single',
      });

      expect(checks.subjectMismatchRows).toHaveLength(1);
      expect(checks.subjectMismatchRows[0]?.severity).toBe('blocking');
      expect(checks.subjectMismatchRows[0]?.message).toBe(
        'No.1 は指定された学科(学科Ⅰ)の対象外です。',
      );
    });

    it('行の想定学科と実データの学科が一致する場合は検出しない', () => {
      const testDataByNo = new Map([[1, baseTestData(1, { subject: '学科Ⅰ' })]]);
      const checks = deriveCreatePdfTestTableChecks({
        sections: [
          makeSection([
            {
              id: 'match',
              sourceConditionId: 'cond-1',
              categoryTable: [
                {
                  id: 'cat-1',
                  subject: '学科Ⅰ',
                  bigCategoryTag: null,
                  smallCategoryTag: null,
                },
              ],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ]),
        ],
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'single',
      });

      expect(checks.subjectMismatchRows).toHaveLength(0);
    });

    it('行条件の学科が空でもセクションの対象学科で判定する', () => {
      const testDataByNo = new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]);
      const checks = deriveCreatePdfTestTableChecks({
        sections: [
          makeSection([
            {
              id: 'no-condition',
              sourceConditionId: 'cond-1',
              categoryTable: [],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ]),
        ],
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'single',
      });

      expect(checks.subjectMismatchRows).toHaveLength(1);
    });

    it('getBlockingTestTableReasonsはsubjectMismatchRowsを含む', () => {
      const testDataByNo = new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]);
      const checks = deriveCreatePdfTestTableChecks({
        sections: [
          makeSection([
            {
              id: 'mismatch',
              sourceConditionId: 'cond-1',
              categoryTable: [
                {
                  id: 'cat-1',
                  subject: '学科Ⅰ',
                  bigCategoryTag: null,
                  smallCategoryTag: null,
                },
              ],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ]),
        ],
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'single',
      });

      const blockingReasons = getBlockingTestTableReasons(checks);
      expect(
        blockingReasons.some((reason) => reason.code === 'subject-out-of-range'),
      ).toBe(true);
    });

    it('getDrawBlockingTestTableReasonsはsubjectMismatchRowsを含まない（再抽選はブロックしない）', () => {
      const testDataByNo = new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]);
      const checks = deriveCreatePdfTestTableChecks({
        sections: [
          makeSection([
            {
              id: 'mismatch',
              sourceConditionId: 'cond-1',
              categoryTable: [
                {
                  id: 'cat-1',
                  subject: '学科Ⅰ',
                  bigCategoryTag: null,
                  smallCategoryTag: null,
                },
              ],
              selectedNo: '1',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ]),
        ],
        testDataByNo,
        showQaaChoiceIndex: false,
        sectionMode: 'single',
      });

      const drawBlockingReasons = getDrawBlockingTestTableReasons(checks);
      expect(
        drawBlockingReasons.some(
          (reason) => reason.code === 'subject-out-of-range',
        ),
      ).toBe(false);
    });
  });
});

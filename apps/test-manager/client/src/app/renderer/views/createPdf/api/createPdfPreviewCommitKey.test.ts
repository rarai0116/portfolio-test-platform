import {
  buildActivePreviewCommitGuardReasons,
  buildExamPreviewCommitKey,
  buildWorkbookPreviewCommitKey,
} from '@views/createPdf/api/createPdfPreviewCommitKey';
import type {
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';
import { describe, expect, it } from 'vitest';

const MINIMAL_ROW: TestTableRow = {
  id: 'row-1',
  sourceConditionId: null,
  categoryTable: [],
  selectedNo: '1',
  qaaChoiceIndex: null,
  isFixed: false,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
};

const MINIMAL_SECTION: TestTableSection = {
  id: 'section-1',
  label: '学科Ⅰ',
  rows: [MINIMAL_ROW],
};

const BASE_EXAM_INPUT = {
  title: 'テスト',
  isShuffleChoices: false,
  shuffleSeed: null,
  sections: [MINIMAL_SECTION] as TestTableSection[],
  mapsVersion: 0,
};

const BASE_WORKBOOK_INPUT = {
  title: 'テスト',
  workbookMode: 'multipleChoice' as const,
  isShuffleChoices: false,
  shuffleSeed: null,
  sections: [MINIMAL_SECTION] as TestTableSection[],
  mapsVersion: 0,
};

describe('createPdfPreviewCommitKey', () => {
  it('exam commit key は title 変更を反映する', () => {
    const baseKey = buildExamPreviewCommitKey(BASE_EXAM_INPUT);
    const nextKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      title: 'タイトル更新',
    });
    expect(nextKey).not.toBe(baseKey);
  });

  it('exam commit key は isShuffleChoices / shuffleSeed 変更を反映する', () => {
    const baseKey = buildExamPreviewCommitKey(BASE_EXAM_INPUT);
    const shuffleKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      isShuffleChoices: true,
      shuffleSeed: 42,
    });
    expect(shuffleKey).not.toBe(baseKey);
  });

  it('exam commit key は mapsVersion 変更を反映する', () => {
    const baseKey = buildExamPreviewCommitKey(BASE_EXAM_INPUT);
    const nextKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      mapsVersion: 1,
    });
    expect(nextKey).not.toBe(baseKey);
  });

  it('exam commit key は実施年月日変更を反映する', () => {
    const baseKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      examDate: { year: '', month: '', day: '' },
    });
    const nextKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      examDate: { year: '2026', month: '7', day: '1' },
    });

    expect(nextKey).not.toBe(baseKey);
  });

  it('workbook commit key は workbookMode と table 変更を反映する', () => {
    const baseKey = buildWorkbookPreviewCommitKey(BASE_WORKBOOK_INPUT);

    const modeChangedKey = buildWorkbookPreviewCommitKey({
      ...BASE_WORKBOOK_INPUT,
      workbookMode: 'qaa',
    });

    const tableChangedKey = buildWorkbookPreviewCommitKey({
      ...BASE_WORKBOOK_INPUT,
      sections: [
        {
          id: 'section-1',
          label: '学科Ⅰ',
          rows: [
            {
              id: 'row-2',
              sourceConditionId: null,
              categoryTable: [],
              selectedNo: '2',
              qaaChoiceIndex: null,
              isFixed: false,
              pageBreakBefore: false,
              hasError: false,
              errorMessage: null,
            },
          ],
        },
      ],
    });

    expect(modeChangedKey).not.toBe(baseKey);
    expect(tableChangedKey).not.toBe(baseKey);
  });

  it('preview table key は固定チェックだけの変更を無視する', () => {
    const baseKey = buildWorkbookPreviewCommitKey(BASE_WORKBOOK_INPUT);
    const fixedChangedKey = buildWorkbookPreviewCommitKey({
      ...BASE_WORKBOOK_INPUT,
      sections: [
        {
          ...MINIMAL_SECTION,
          rows: [{ ...MINIMAL_ROW, isFixed: true }],
        },
      ],
    });

    expect(fixedChangedKey).toBe(baseKey);
  });

  it('preview table key は問題No / 選択肢No / 改行チェックの変更を反映する', () => {
    const baseKey = buildExamPreviewCommitKey(BASE_EXAM_INPUT);

    const selectedNoChangedKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      sections: [
        {
          ...MINIMAL_SECTION,
          rows: [{ ...MINIMAL_ROW, selectedNo: '2' }],
        },
      ],
    });
    const qaaChoiceChangedKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      sections: [
        {
          ...MINIMAL_SECTION,
          rows: [{ ...MINIMAL_ROW, qaaChoiceIndex: 2 }],
        },
      ],
    });
    const pageBreakChangedKey = buildExamPreviewCommitKey({
      ...BASE_EXAM_INPUT,
      sections: [
        {
          ...MINIMAL_SECTION,
          rows: [{ ...MINIMAL_ROW, pageBreakBefore: true }],
        },
      ],
    });

    expect(selectedNoChangedKey).not.toBe(baseKey);
    expect(qaaChoiceChangedKey).not.toBe(baseKey);
    expect(pageBreakChangedKey).not.toBe(baseKey);
  });

  it('guard evaluator は有効な guard を配列で返す', () => {
    const reasons = buildActivePreviewCommitGuardReasons({
      isLoadingTestData: true,
      isGradeChangeDialogOpen: false,
      isJsonLoading: true,
      isResetPending: false,
      isTableEditing: true,
      hasBlockingTestTableError: false,
    });

    expect(reasons).toEqual([
      {
        id: 'test-data-loading',
        message: '問題データ読込中はプレビュー更新を保留します。',
      },
      {
        id: 'json-loading',
        message: 'JSON読込中はプレビュー更新を保留します。',
      },
      {
        id: 'table-editing',
        message: '問題テーブル編集中はプレビュー更新を保留します。',
      },
    ]);
  });

  it('問題テーブルにblockingエラーがある場合はtest-table-blocking-error guardを返す', () => {
    const reasons = buildActivePreviewCommitGuardReasons({
      isLoadingTestData: false,
      isGradeChangeDialogOpen: false,
      isJsonLoading: false,
      isResetPending: false,
      isTableEditing: false,
      hasBlockingTestTableError: true,
    });

    expect(reasons).toEqual([
      {
        id: 'test-table-blocking-error',
        message: '問題テーブルにエラーがあるためプレビュー更新を保留します。',
      },
    ]);
  });
});

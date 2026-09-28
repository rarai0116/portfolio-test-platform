import type { TestData } from '@shared/types/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createInitialExamState } from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useExamStepTwo from './useExamStepTwo';

const createTestData = (
  no: number,
  subject: TestData['subject'] = '学科Ⅰ',
  difficult = '1',
  bigCategoryTag = '大分類A',
  smallCategoryTag = '小分類A-1',
): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag,
  ch1: '',
  ch2: '',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult,
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo: '',
  no,
  parentNo: 0,
  smallCategoryTag,
  status: '準備完了',
  subject,
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
});

const createTableRow = (id: string, conditionId: string): TestTableRow => ({
  id,
  sourceConditionId: conditionId,
  categoryTable: [],
  selectedNo: null,
  qaaChoiceIndex: null,
  isFixed: false,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
});

describe('useExamStepTwo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useExamDraftStore.setState(createInitialExamState());
    useCreatePdfResourceStore.getState().actions.reset();
    useTestTableStore.getState().actions.reset();
  });

  it('枠条件追加で次の学科を選び、table section を生成する', () => {
    const testDataByNo = new Map([
      [1, createTestData(1)],
      [2, createTestData(2)],
    ]);

    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: testDataByNo,
        byId: new Map(
          [...testDataByNo.values()].map((testData) => [
            testData.id ?? '',
            testData,
          ]),
        ),
        byUuid: new Map(),
      },
      isLoading: false,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { result } = renderHook(() =>
      useExamStepTwo({ selectedYearNos: null }),
    );

    act(() => {
      result.current.addCategoryTableRow();
    });

    const state = useExamDraftStore.getState();
    const tableState = useTestTableStore.getState();

    expect(state.stepTwo.categoryTable).toHaveLength(1);
    expect(state.stepTwo.categoryTable[0]?.subject).toBe('学科Ⅰ');
    expect(tableState.sections).toHaveLength(1);
    expect(tableState.sections[0]?.label).toBe('学科Ⅰ');
    expect(tableState.sections[0]?.rows).toHaveLength(2);
    expect(tableState.sections[0]?.shortageCount).toBe(18);
    expect(tableState.lastAppliedDrawConditionKey).not.toBeNull();
    expect(tableState.lastSavedOrRestoredTableKey).not.toBeNull();
  });

  it('読込中は枠条件追加を行わない', () => {
    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: new Map(),
        byId: new Map(),
        byUuid: new Map(),
      },
      isLoading: true,
    });

    const { result } = renderHook(() =>
      useExamStepTwo({ selectedYearNos: null }),
    );

    act(() => {
      result.current.addCategoryTableRow();
    });

    const state = useExamDraftStore.getState();
    const tableState = useTestTableStore.getState();

    expect(state.stepTwo.categoryTable).toHaveLength(0);
    expect(tableState.sections).toHaveLength(0);
  });

  it('抽選実行は全学科を一括抽選し、結果を学科別 section に戻す', async () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', '1')],
      [2, createTestData(2, '学科Ⅱ', '2')],
    ]);

    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: testDataByNo,
        byId: new Map(
          [...testDataByNo.values()].map((testData) => [
            testData.id ?? '',
            testData,
          ]),
        ),
        byUuid: new Map(),
      },
      isLoading: false,
    });

    const initial = createInitialExamState();
    useExamDraftStore.setState({
      ...initial,
      stepTwo: {
        ...initial.stepTwo,
        difficulty: {
          ...initial.stepTwo.difficulty,
          isCalculated: true,
          ratios: [50, 100],
          entityCount: [1, 1, 0],
        },
        categoryTable: [
          {
            id: 'condition-subject-1',
            subject: '学科Ⅰ',
            categoryConditions: [],
          },
          {
            id: 'condition-subject-2',
            subject: '学科Ⅱ',
            categoryConditions: [],
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useExamStepTwo({ selectedYearNos: null }),
    );

    await act(async () => {
      await result.current.executeDraw();
    });

    expect(result.current.drawErrorMessage).toBeNull();

    const tableState = useTestTableStore.getState();
    expect(tableState.sections).toHaveLength(2);
    expect(tableState.sections[0]?.label).toBe('学科Ⅰ');
    expect(tableState.sections[0]?.rows).toHaveLength(1);
    expect(tableState.sections[0]?.rows[0]?.selectedNo).toBe('1');
    expect(tableState.sections[1]?.label).toBe('学科Ⅱ');
    expect(tableState.sections[1]?.rows).toHaveLength(1);
    expect(tableState.sections[1]?.rows[0]?.selectedNo).toBe('2');
  });

  it('sourceConditionId が欠けた固定行は抽選前に枠へ再接続され末尾に追加されない', async () => {
    const testDataByNo = new Map([
      [1, createTestData(1, '学科Ⅰ', '1', '大分類A', '小分類A-1')],
    ]);

    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: testDataByNo,
        byId: new Map(
          [...testDataByNo.values()].map((testData) => [
            testData.id ?? '',
            testData,
          ]),
        ),
        byUuid: new Map(),
      },
      isLoading: false,
    });

    const initial = createInitialExamState();
    useExamDraftStore.setState({
      ...initial,
      stepTwo: {
        ...initial.stepTwo,
        categoryTable: [
          {
            id: 'condition-1',
            subject: '学科Ⅰ',
            categoryConditions: [{ big: '大分類B', small: '小分類B-1' }],
          },
        ],
      },
    });
    useTestTableStore.getState().actions.applyDrawResult({
      sections: [
        {
          id: 'section-subject-1',
          label: '学科Ⅰ',
          rows: [
            {
              ...createTableRow('row-1', 'condition-before-restore'),
              sourceConditionId: null,
              selectedNo: '1',
              isFixed: true,
            },
          ],
        },
      ],
      drawConditionKey: 'initial-key',
    });

    const { result } = renderHook(() =>
      useExamStepTwo({ selectedYearNos: null }),
    );

    await act(async () => {
      await result.current.executeDraw();
    });

    expect(result.current.drawErrorMessage).toBeNull();

    const tableState = useTestTableStore.getState();
    expect(tableState.sections[0]?.rows).toHaveLength(1);
    expect(tableState.sections[0]?.rows[0]?.selectedNo).toBe('1');
    expect(tableState.sections[0]?.rows[0]?.isFixed).toBe(true);
    expect(tableState.sections[0]?.rows[0]?.sourceConditionId).toBe(
      'condition-1',
    );
    expect(tableState.sections[0]?.rows[0]?.categoryTable[0]).toMatchObject({
      bigCategoryTag: '大分類B',
      smallCategoryTag: '小分類B-1',
    });
  });

  it('規定問数を超えた exam category rows と table rows を正規化する', async () => {
    const initial = createInitialExamState();
    const categoryTable = Array.from({ length: 21 }, (_, index) => ({
      id: `condition-${index + 1}`,
      subject: '学科Ⅰ' as const,
      categoryConditions: [],
    }));

    useExamDraftStore.setState({
      ...initial,
      stepTwo: {
        ...initial.stepTwo,
        categoryTable,
      },
    });
    useTestTableStore.getState().actions.applyDrawResult({
      sections: [
        {
          id: 'section-subject-1',
          label: '学科Ⅰ',
          rows: categoryTable.map((row, index) =>
            createTableRow(`row-${index + 1}`, row.id),
          ),
        },
      ],
      drawConditionKey: 'initial-key',
    });

    renderHook(() => useExamStepTwo({ selectedYearNos: null }));

    await waitFor(() => {
      expect(useExamDraftStore.getState().stepTwo.categoryTable).toHaveLength(
        20,
      );
      expect(useTestTableStore.getState().sections[0]?.rows).toHaveLength(20);
    });

    expect(
      useExamDraftStore.getState().stepTwo.categoryTable.map((row) => row.id),
    ).not.toContain('condition-21');
    expect(
      useTestTableStore
        .getState()
        .sections[0]?.rows.map((row) => row.sourceConditionId),
    ).not.toContain('condition-21');
  });
});

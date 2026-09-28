import type { TestData } from '@shared/types/contracts';
import { act, renderHook } from '@testing-library/react';
import { createInitialWorkbookState } from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useWorkbookMockStepTwo from './useWorkbookMockStepTwo';

const createTestData = (
  no: number,
  subject: TestData['subject'],
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
  subject,
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
});

describe('useWorkbookMockStepTwo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkbookDraftStore.setState(createInitialWorkbookState());
    useCreatePdfResourceStore.getState().actions.reset();
    useTestTableStore.getState().actions.reset();
  });

  it('学科条件を追加し、生成で workbook table を構築する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: new Map([
          [1, createTestData(1, '学科Ⅰ')],
          [2, createTestData(2, '学科Ⅰ')],
        ]),
        byId: new Map(),
        byUuid: new Map(),
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useWorkbookMockStepTwo());

    act(() => {
      result.current.addCategoryCondition();
    });

    expect(useWorkbookDraftStore.getState().stepTwo.categoryTable).toHaveLength(
      1,
    );
    expect(
      useWorkbookDraftStore.getState().stepTwo.categoryTable[0]?.subject,
    ).toBe('学科Ⅰ');

    const conditionId =
      useWorkbookDraftStore.getState().stepTwo.categoryTable[0]?.id;

    if (!conditionId) {
      throw new Error('学科条件 ID が取得できませんでした');
    }

    act(() => {
      result.current.updateCategoryCondition(conditionId, (condition) => ({
        ...condition,
        count: 3,
      }));
    });

    act(() => {
      result.current.generateTable();
    });

    const tableState = useTestTableStore.getState();
    expect(tableState.sections[0]?.rows).toHaveLength(2);
    expect(result.current.summaries[0]?.shortageCount).toBe(1);
    expect(tableState.lastAppliedDrawConditionKey).not.toBeNull();
    expect(tableState.lastSavedOrRestoredTableKey).not.toBeNull();
  });

  it('読込中は table 生成を行わない', () => {
    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: new Map(),
        byId: new Map(),
        byUuid: new Map(),
      },
      isLoading: true,
    });

    const { result } = renderHook(() => useWorkbookMockStepTwo());

    act(() => {
      result.current.generateTable();
    });

    expect(useTestTableStore.getState().sections).toHaveLength(0);
    expect(result.current.summaries).toHaveLength(0);
  });
});

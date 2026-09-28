import { act, renderHook } from '@testing-library/react';
import {
  createInitialDifficultyState,
  createInitialWorkbookState,
} from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useWorkbookPanelModel from './useWorkbookPanelModel';

// useOtherTagOptions の非同期 effect による act() 警告を抑制
vi.mock('@views/createPdf/hooks/useOtherTagOptions', () => ({
  useOtherTagOptions: () => ({ tagOptions: [] }),
}));

describe('useWorkbookPanelModel', () => {
  beforeEach(() => {
    useWorkbookDraftStore.setState(createInitialWorkbookState());
    useTestTableStore.getState().actions.reset();
    useCreatePdfViewStore.getState().actions.setCurrentPreviewState(null);
  });

  it('級変更は変更有無に関わらず確認ダイアログを経由する', () => {
    const { result } = renderHook(() => useWorkbookPanelModel());

    act(() => {
      result.current.commands.requestGradeChange(2);
    });

    expect(useWorkbookDraftStore.getState().basic.grade).toBe(1);
    expect(result.current.dialogs.gradeChange.isOpen).toBe(true);
    expect(result.current.dialogs.gradeChange.pendingGrade).toBe(2);
  });

  it('変更がある場合の級変更は確認ダイアログを経由し、保持対象だけ残す', () => {
    const initial = createInitialWorkbookState();
    useWorkbookDraftStore.setState({
      ...initial,
      basic: { ...initial.basic, title: '確認タイトル' },
      stepTwo: {
        ...initial.stepTwo,
        workbookMode: 'multipleChoice',
        categoryTable: [
          {
            id: 'condition-1',
            subject: '学科Ⅰ',
            bigCategoryTag: '大分類A',
            smallCategoryTag: '小分類A-1',
            count: 3,
          },
        ],
      },
      stepThree: {
        ...initial.stepThree,
        selectedOutputFolder: '/tmp/output',
      },
    });
    // 問題テーブルは useTestTableStore で管理される
    useTestTableStore.setState({
      ...useTestTableStore.getState(),
      sections: [
        {
          id: 'workbook-single',
          label: 'workbook',
          rows: [
            {
              id: 'row-1',
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
    });

    const { result } = renderHook(() => useWorkbookPanelModel());

    act(() => {
      result.current.commands.requestGradeChange(2);
    });

    expect(useWorkbookDraftStore.getState().basic.grade).toBe(1);
    expect(result.current.dialogs.gradeChange.isOpen).toBe(true);
    expect(result.current.dialogs.gradeChange.pendingGrade).toBe(2);

    act(() => {
      result.current.commands.confirmGradeChange();
    });

    const next = useWorkbookDraftStore.getState();
    const tableState = useTestTableStore.getState();

    expect(next.basic.grade).toBe(2);
    expect(next.basic.title).toBe('確認タイトル');
    expect(next.stepTwo.workbookMode).toBe('multipleChoice');
    expect(next.stepTwo.categoryTable).toHaveLength(0);
    expect(tableState.sections).toHaveLength(0);
    expect(tableState.settings.showQaaChoiceIndex).toBe(false);
    expect(next.stepThree.selectedOutputFolder).toBe('/tmp/output');
  });

  it('問題形式変更で testTable をリセットすると showQaaChoiceIndex を次の mode に合わせる', () => {
    const initial = createInitialWorkbookState();
    useWorkbookDraftStore.setState({
      ...initial,
      stepTwo: {
        ...initial.stepTwo,
        workbookMode: 'multipleChoice',
      },
    });
    useTestTableStore.setState({
      ...useTestTableStore.getState(),
      settings: { showQaaChoiceIndex: false },
    });

    const { result } = renderHook(() => useWorkbookPanelModel());

    act(() => {
      result.current.stepTwo.updateWorkbookMode('qaa');
    });

    expect(useWorkbookDraftStore.getState().stepTwo.workbookMode).toBe('qaa');
    expect(useTestTableStore.getState().settings.showQaaChoiceIndex).toBe(true);
  });

  it('出題年変更時に計算済みの難易度調整をリセットする', () => {
    const initial = createInitialWorkbookState();
    useWorkbookDraftStore.setState({
      ...initial,
      basic: { ...initial.basic, selectedYears: ['令和5'] },
      stepTwo: {
        ...initial.stepTwo,
        difficulty: {
          isCalculated: true,
          ratios: [20, 60],
          entityCount: [1, 2, 3],
          settableDifficultyRanges: [
            { min: 0, max: 20 },
            { min: 20, max: 80 },
            { min: 0, max: 20 },
          ],
        },
      },
    });

    const { result } = renderHook(() => useWorkbookPanelModel());

    act(() => {
      result.current.stepOne.yearFilter.onSelectedYearsChange(['令和6']);
    });

    const state = useWorkbookDraftStore.getState();
    expect(state.basic.selectedYears).toEqual(['令和6']);
    expect(state.stepTwo.difficulty).toEqual(createInitialDifficultyState());
  });
});

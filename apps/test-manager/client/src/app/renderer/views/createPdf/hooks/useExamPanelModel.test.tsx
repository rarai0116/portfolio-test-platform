import { act, renderHook } from '@testing-library/react';
import {
  createInitialDifficultyState,
  createInitialExamState,
} from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useExamPanelModel from './useExamPanelModel';

vi.mock('@views/createPdf/hooks/useOtherTagOptions', () => ({
  useOtherTagOptions: () => ({ tagOptions: [] }),
}));

describe('useExamPanelModel', () => {
  beforeEach(() => {
    useExamDraftStore.setState(createInitialExamState());
    useTestTableStore.getState().actions.reset();
    useCreatePdfViewStore.getState().actions.setCurrentPreviewState(null);
  });

  it('出題年変更時に計算済みの難易度調整をリセットする', () => {
    const initial = createInitialExamState();
    useExamDraftStore.setState({
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

    const { result } = renderHook(() => useExamPanelModel());

    act(() => {
      result.current.stepOne.yearFilter.onSelectedYearsChange(['令和6']);
    });

    const state = useExamDraftStore.getState();
    expect(state.basic.selectedYears).toEqual(['令和6']);
    expect(state.stepTwo.difficulty).toEqual(createInitialDifficultyState());
  });
});

import { buildSlotKey } from '@shared/types/pdfPreview';
import { act, renderHook } from '@testing-library/react';
import { createInitialWorkbookState } from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCreatePdfPreviewCommit from './useCreatePdfPreviewCommit';

const { commitCreatePdfPreviewDocumentMock } = vi.hoisted(() => ({
  commitCreatePdfPreviewDocumentMock: vi.fn(),
}));

vi.mock('@renderer/api/pdfPreviewBridge', async () => {
  const actual = await vi.importActual<object>(
    '@renderer/api/pdfPreviewBridge',
  );
  return {
    ...actual,
    commitCreatePdfPreviewDocument: commitCreatePdfPreviewDocumentMock,
  };
});

vi.mock('@views/createPdf/hooks/useCreatePdfImageAsset', () => ({
  default: () => ({ imageItems: [] }),
}));

// useCreatePdfPreviewCommit は Zustand store を参照するため、
// commit 実行テストは renderHook + store 初期化が整ったタイミングで別途追加する。
// ここでは hook が内部で使用する buildSlotKey の slotKey 生成を検証する。

describe('buildSlotKey（useCreatePdfPreviewCommit から利用）', () => {
  beforeEach(() => {
    commitCreatePdfPreviewDocumentMock.mockReset();
    commitCreatePdfPreviewDocumentMock.mockResolvedValue({
      ok: true,
      meta: {
        creationType: 'workbook',
        slotKey: 'grade:2:workbookMode:multipleChoice',
        revision: 1,
        updatedAt: 'updated-at',
      },
    });
    useCreatePdfViewStore.getState().actions.reset();
    useWorkbookDraftStore.getState().actions.reset();
    useCreatePdfResourceStore.setState((state) => ({
      ...state,
      testData: {
        ...state.testData,
        testDataByNo: new Map(),
        isLoading: false,
      },
    }));
  });

  it('exam モード: workbookMode が null の場合は grade のみ', () => {
    expect(buildSlotKey({ grade: 1, workbookMode: null })).toBe('grade:1');
  });

  it('workbook モード: grade + workbookMode を連結', () => {
    expect(buildSlotKey({ grade: 2, workbookMode: 'qaaAllTrue' })).toBe(
      'grade:2:workbookMode:qaaAllTrue',
    );
  });

  it('workbook モード: qaaAllFalse の場合も連結する', () => {
    expect(buildSlotKey({ grade: 1, workbookMode: 'qaaAllFalse' })).toBe(
      'grade:1:workbookMode:qaaAllFalse',
    );
  });

  it('workbook commit は legacy view store ではなく draft store を正本にする', async () => {
    useCreatePdfViewStore.setState({
      creationType: 'workbook',
      grade: 1,
      title: 'common-title',
      selectedOutputFolder: '/common/output',
      isDirtyConditions: false,
      currentPreviewState: null,
    });

    const initial = createInitialWorkbookState();
    useWorkbookDraftStore.setState({
      ...initial,
      basic: { grade: 2, title: 'draft-title', selectedYears: null },
      stepTwo: { ...initial.stepTwo, workbookMode: 'multipleChoice' },
      stepThree: {
        ...initial.stepThree,
        selectedOutputFolder: '/draft/output',
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

    const { result } = renderHook(() => useCreatePdfPreviewCommit());

    await act(async () => {
      await result.current.commit();
    });

    expect(commitCreatePdfPreviewDocumentMock).toHaveBeenCalledTimes(1);
    const firstCall = commitCreatePdfPreviewDocumentMock.mock.calls[0]?.[0];
    expect(firstCall.slotKey).toBe('grade:2:workbookMode:multipleChoice');
    expect(
      firstCall.document.slots['grade:2:workbookMode:multipleChoice']
        .restoreState.gradeId,
    ).toBe(2);
    expect(
      firstCall.document.slots['grade:2:workbookMode:multipleChoice']
        .restoreState.title,
    ).toBe('draft-title');
  });
});

import type { TestData } from '@shared/types/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createInitialExamState } from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import useCreatePdfViewStore from '@views/createPdf/store/useCreatePdfViewStore';
import useExamDraftStore from '@views/createPdf/store/useExamDraftStore';
import useTestTableStore from '@views/createPdf/store/useTestTableStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCreatePdfPreviewUpdateController, {
  useCreatePdfPreviewUpdateControllerStore,
} from './useCreatePdfPreviewUpdateController';

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

const commitMock = vi.fn();

const previewCommitState = {
  commit: commitMock,
  lastMeta: null,
  isCommitting: false,
  isLoadingTestData: false,
  isLoadingImageMeta: false,
  imageMetaSignature: '',
};

vi.mock('@views/createPdf/hooks/useCreatePdfPreviewCommit', () => ({
  default: () => previewCommitState,
}));

describe('store/useCreatePdfPreviewUpdateController', () => {
  beforeEach(() => {
    commitMock.mockReset();
    commitMock.mockResolvedValue({
      ok: true,
      meta: {
        creationType: 'exam',
        slotKey: 'grade:1',
        revision: 1,
        updatedAt: 'updated-at',
      },
    });
    previewCommitState.lastMeta = null;
    previewCommitState.isCommitting = false;
    previewCommitState.isLoadingTestData = false;
    previewCommitState.isLoadingImageMeta = false;
    previewCommitState.imageMetaSignature = '';

    useCreatePdfPreviewUpdateControllerStore.getState().actions.reset();
    useCreatePdfViewStore.getState().actions.reset();
    useCreatePdfResourceStore.getState().actions.reset();
    useExamDraftStore.setState(createInitialExamState());
    useWorkbookDraftStore.getState().actions.reset();
    // No.1 をテストデータとして用意し、行の testTableChecks が invalid-no で
    // blocking にならないようにする（hasBlockingTestTableError 追加に伴う前提整備）
    useCreatePdfResourceStore.getState().actions.setTestData({
      maps: {
        byNo: new Map([[1, baseTestData(1)]]),
        byId: new Map(),
        byUuid: new Map(),
      },
      isLoading: false,
    });
    // commitKey が null にならないよう最小セクションを設定する
    useTestTableStore.getState().actions.replaceSections(
      [
        {
          id: 'section-1',
          label: '学科Ⅰ',
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
      'initial-key',
    );
  });

  it('guard が無い場合は mount 後に auto commit する', async () => {
    renderHook(() => useCreatePdfPreviewUpdateController('exam'));

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
  });

  it('guard 中は commit せず、guard 解除後に 1 回だけ auto commit する', async () => {
    previewCommitState.isLoadingTestData = true;

    const { result, rerender } = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    expect(commitMock).not.toHaveBeenCalled();
    expect(
      result.current.activeGuardReasons.map((reason) => reason.id),
    ).toEqual(['test-data-loading']);

    act(() => {
      previewCommitState.isLoadingTestData = false;
      rerender();
    });

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
  });

  it('画像メタ読込中でも auto commit し、画像メタ更新だけでは再 commit しない', async () => {
    previewCommitState.isLoadingImageMeta = true;

    const { result, rerender } = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    expect(
      result.current.activeGuardReasons.map((reason) => reason.id),
    ).toEqual([]);

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      previewCommitState.isLoadingImageMeta = false;
      previewCommitState.imageMetaSignature = 'img-1:120:80';
      rerender();
    });

    expect(commitMock).toHaveBeenCalledTimes(1);
  });

  it('table editing 中は guard し、編集終了後に auto commit する', async () => {
    previewCommitState.isLoadingTestData = true;

    const { result, rerender } = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    act(() => {
      result.current.beginGuardedEdit('row-1:selected-no');
      previewCommitState.isLoadingTestData = false;
      rerender();
    });

    expect(commitMock).not.toHaveBeenCalled();
    expect(
      result.current.activeGuardReasons.map((reason) => reason.id),
    ).toContain('table-editing');

    act(() => {
      result.current.endGuardedEdit('row-1:selected-no');
      rerender();
    });

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
  });

  it('JSON適用中はcommitせず、最新commitKey同期後にguardを解除してcommitする', async () => {
    previewCommitState.isLoadingTestData = true;

    const { rerender } = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    act(() => {
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.beginJsonLoading();
      useExamDraftStore
        .getState()
        .actions.setBasic({ title: 'インポート後タイトル' });
      previewCommitState.isLoadingTestData = false;
      rerender();
    });

    expect(commitMock).not.toHaveBeenCalled();
    expect(
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .activeGuardReasons.map((reason) => reason.id),
    ).toContain('json-loading');

    act(() => {
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.markJsonApplyCompleted();
    });

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
    expect(
      useCreatePdfPreviewUpdateControllerStore.getState().isJsonLoading,
    ).toBe(false);
  });

  it('同一commitKeyの再インポートでも新しいcommitを1回実行する', async () => {
    renderHook(() => useCreatePdfPreviewUpdateController('exam'));

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.beginJsonLoading();
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.markJsonApplyCompleted();
    });

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(2);
    });
  });

  it('JSON読込キャンセルではcommitを強制実行しない', () => {
    previewCommitState.isLoadingTestData = true;
    renderHook(() => useCreatePdfPreviewUpdateController('exam'));

    act(() => {
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.beginJsonLoading();
      useCreatePdfPreviewUpdateControllerStore
        .getState()
        .actions.cancelJsonLoading();
    });

    expect(commitMock).not.toHaveBeenCalled();
    expect(
      useCreatePdfPreviewUpdateControllerStore.getState().isJsonLoading,
    ).toBe(false);
  });

  it('in-flight 中に commit key が変わった場合は解除後に最新状態で再実行する', async () => {
    previewCommitState.isCommitting = true;

    const { rerender } = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    act(() => {
      useExamDraftStore
        .getState()
        .actions.setBasic({ title: '再実行後タイトル' });
    });

    expect(commitMock).not.toHaveBeenCalled();

    act(() => {
      previewCommitState.isCommitting = false;
      rerender();
    });

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
  });

  it('unmount 後に同じ commit key で再 mount しても auto commit する', async () => {
    const firstRender = renderHook(() =>
      useCreatePdfPreviewUpdateController('exam'),
    );

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });

    firstRender.unmount();
    commitMock.mockClear();

    renderHook(() => useCreatePdfPreviewUpdateController('exam'));

    await waitFor(() => {
      expect(commitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('学科対象外エラーによるプレビュー更新の停止', () => {
    it('mount時に学科不一致行がある場合、guardが立ちauto commitが1回も走らない', async () => {
      useCreatePdfResourceStore.getState().actions.setTestData({
        maps: {
          byNo: new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]),
          byId: new Map(),
          byUuid: new Map(),
        },
        isLoading: false,
      });
      // 行の想定学科(学科Ⅰ)と実データの学科(学科Ⅱ)が不一致のテーブルに変更する
      useTestTableStore.getState().actions.replaceSections(
        [
          {
            id: 'section-1',
            label: '学科Ⅰ',
            // 学科対象外チェックは section.subject を基準に判定するため必須
            subject: '学科Ⅰ',
            rows: [
              {
                id: 'row-1',
                sourceConditionId: null,
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
            ],
          },
        ],
        'mismatch-key',
      );

      const { result } = renderHook(() =>
        useCreatePdfPreviewUpdateController('exam'),
      );

      // commitKey が確定する同じレンダー・同じ effect で guard が立つことを確認する
      // （useCreatePdfStatusStore 経由の非同期な反映を待たずに即座に成立する必要がある）
      await waitFor(() => {
        expect(result.current.activeGuardReasons.map((r) => r.id)).toContain(
          'test-table-blocking-error',
        );
      });

      // 自動更新が一度も実行されていないことを確認する（レビューで指摘された競合の再発防止）
      expect(commitMock).not.toHaveBeenCalled();
    });

    it('学科不一致を解消すると自動更新が実行される', async () => {
      useCreatePdfResourceStore.getState().actions.setTestData({
        maps: {
          byNo: new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]),
          byId: new Map(),
          byUuid: new Map(),
        },
        isLoading: false,
      });
      useTestTableStore.getState().actions.replaceSections(
        [
          {
            id: 'section-1',
            label: '学科Ⅰ',
            // 学科対象外チェックは section.subject を基準に判定するため必須
            subject: '学科Ⅰ',
            rows: [
              {
                id: 'row-1',
                sourceConditionId: null,
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
            ],
          },
        ],
        'mismatch-key',
      );

      const { result, rerender } = renderHook(() =>
        useCreatePdfPreviewUpdateController('exam'),
      );

      await waitFor(() => {
        expect(result.current.activeGuardReasons.map((r) => r.id)).toContain(
          'test-table-blocking-error',
        );
      });
      expect(commitMock).not.toHaveBeenCalled();

      act(() => {
        // 実データの学科を行の想定学科と一致させて不一致を解消する
        useCreatePdfResourceStore.getState().actions.setTestData({
          maps: {
            byNo: new Map([[1, baseTestData(1, { subject: '学科Ⅰ' })]]),
            byId: new Map(),
            byUuid: new Map(),
          },
          isLoading: false,
        });
        rerender();
      });

      await waitFor(() => {
        expect(commitMock).toHaveBeenCalledTimes(1);
      });
      expect(
        result.current.activeGuardReasons.map((r) => r.id),
      ).not.toContain('test-table-blocking-error');
    });

    it('手動更新も学科不一致エラー中は実行されない', async () => {
      useCreatePdfResourceStore.getState().actions.setTestData({
        maps: {
          byNo: new Map([[1, baseTestData(1, { subject: '学科Ⅱ' })]]),
          byId: new Map(),
          byUuid: new Map(),
        },
        isLoading: false,
      });
      useTestTableStore.getState().actions.replaceSections(
        [
          {
            id: 'section-1',
            label: '学科Ⅰ',
            // 学科対象外チェックは section.subject を基準に判定するため必須
            subject: '学科Ⅰ',
            rows: [
              {
                id: 'row-1',
                sourceConditionId: null,
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
            ],
          },
        ],
        'mismatch-key',
      );

      const { result } = renderHook(() =>
        useCreatePdfPreviewUpdateController('exam'),
      );

      await waitFor(() => {
        expect(result.current.activeGuardReasons.map((r) => r.id)).toContain(
          'test-table-blocking-error',
        );
      });

      await act(async () => {
        await result.current.requestManualCommit();
      });

      expect(commitMock).not.toHaveBeenCalled();
    });
  });
});

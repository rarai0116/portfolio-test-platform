import { act, renderHook, waitFor } from '@testing-library/react';
import { createInitialWorkbookState } from '@views/createPdf/api/createPdfDraftFactory';
import useCreatePdfStatusRuntimeStore from '@views/createPdf/store/useCreatePdfStatusRuntimeStore';
import useCreatePdfStatusStore from '@views/createPdf/store/useCreatePdfStatusStore';
import useWorkbookDraftStore from '@views/createPdf/store/useWorkbookDraftStore';
import type { CreatePdfDrawConditionChangeStatus } from '@views/createPdf/types/statusState';
import type { CreatePdfStepThreeAdapter } from '@views/createPdf/types/panelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useWorkbookPdfExport from './useWorkbookPdfExport';

const CLOSED_STATUS = {
  isOpen: false,
  isReady: false,
  creationType: null,
  slotKey: null,
  revision: null,
  isRendering: false,
} as const;

const createPreviewUpdate = (
  overrides: Partial<CreatePdfPreviewUpdateAdapter> = {},
): CreatePdfPreviewUpdateAdapter => ({
  isCommitting: false,
  hasCommitKey: false,
  isLoadingTestData: false,
  lastMeta: {
    creationType: 'workbook',
    slotKey: 'grade:1:workbookMode:qaa',
    revision: 5,
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  activeGuardReasons: [],
  issues: [],
  requestManualCommit: vi.fn(async () => {}),
  setGradeChangeDialogOpen: vi.fn(),
  beginGuardedEdit: vi.fn(),
  endGuardedEdit: vi.fn(),
  ...overrides,
});

const useTestTarget = (previewUpdate: CreatePdfPreviewUpdateAdapter) => {
  const output = useWorkbookDraftStore((state) => state.stepThree);

  const stepThree: CreatePdfStepThreeAdapter = {
    output,
    previewHealth: {
      hasRendering: false,
      hasLoading: false,
      hasFailedImage: false,
      hasKaTeXError: false,
      hasAnyError: false,
      isHealthy: true,
    },
    hasUnsavedTableChanges: false,
    canExport: true,
    onOutputChange: (patch) => {
      useWorkbookDraftStore.getState().actions.setStepThree(patch);
    },
  };

  return useWorkbookPdfExport({
    stepThree,
    previewUpdate,
  });
};

describe('useWorkbookPdfExport', () => {
  beforeEach(() => {
    useCreatePdfStatusRuntimeStore.getState().actions.reset();
    useWorkbookDraftStore.setState(createInitialWorkbookState());
    useWorkbookDraftStore
      .getState()
      .actions.setBasic({ title: 'Workbook Test' });
    useWorkbookDraftStore.getState().actions.setWorkbookMode('qaa');

    window.createPdfExport = {
      openPreviewWindow: vi.fn(async () => ({
        ok: true as const,
        reused: false,
      })),
      closePreviewWindow: vi.fn(async () => ({ ok: true as const })),
      onPreviewWindowClosed: vi.fn(() => () => {}),
      getPreviewWindowStatus: vi.fn(async () => ({
        ok: true as const,
        status: CLOSED_STATUS,
      })),
      requestPreviewUpdate: vi.fn(async () => ({ ok: true as const })),
      selectOutputDirectory: vi.fn(async () => ({
        ok: true as const,
        selectedPath: '/tmp/workbook-output',
      })),
      exportPdf: vi.fn(async () => ({
        ok: true as const,
        outputFolderPath: '/tmp/workbook-output/exported',
        files: [
          '/tmp/workbook-output/exported/問題集_1級_一問一答_Workbook Test.pdf',
        ],
      })),
      loadConditionJson: vi
        .fn()
        .mockResolvedValue({ ok: false, error: 'cancelled' }), // T27追加
      onPreviewUpdateRequested: vi.fn(() => () => {}),
    };
  });

  afterEach(() => {
    act(() => {
      useCreatePdfStatusRuntimeStore.getState().actions.reset();
      useCreatePdfStatusStore.getState().actions.reset();
    });
    vi.useRealTimers();
  });

  // export ゲーティングは drawConditionChangeStatus を参照する。
  // 既定は 'not-drawn'（=未抽選ブロッキング）のため、抽選済み相当にする。
  const setDrawConditionChangeStatus = (
    kind: CreatePdfDrawConditionChangeStatus['kind'],
  ) => {
    const state = useCreatePdfStatusStore.getState();
    state.actions.replaceSnapshot({
      ...state,
      drawConditionChangeStatus: {
        ...state.drawConditionChangeStatus,
        kind,
      },
    });
  };

  it('出力先フォルダ選択で stepThree を更新する', async () => {
    const previewUpdate = createPreviewUpdate();
    const { result } = renderHook(() => useTestTarget(previewUpdate));

    await act(async () => {
      await result.current.selectOutputDirectory();
    });

    expect(window.createPdfExport.selectOutputDirectory).toHaveBeenCalledWith({
      defaultPath: null,
    });
    expect(
      useWorkbookDraftStore.getState().stepThree.selectedOutputFolder,
    ).toBe('/tmp/workbook-output');
    expect(result.current.outputDirectory).toBe('/tmp/workbook-output');
  });

  it('現在の preview meta を使って export request を組み立てる', async () => {
    // saveConditionJson=true では conditionJson が自動生成され、動的な
    // createdAt/shuffleSeed を含むため、本テストでは false にして null を検証する。
    useWorkbookDraftStore.getState().actions.setStepThree({
      selectedOutputFolder: '/tmp/workbook-output',
      saveConditionJson: false,
    });

    const previewUpdate = createPreviewUpdate();
    const { result } = renderHook(() => useTestTarget(previewUpdate));

    await act(async () => {
      await result.current.exportPdf();
    });

    expect(window.createPdfExport.exportPdf).toHaveBeenCalledWith({
      creationType: 'workbook',
      slotKey: 'grade:1:workbookMode:qaa',
      expectedRevision: 5,
      outputDirectory: '/tmp/workbook-output',
      includeCover: true,
      conditionJson: null,
    });
    expect(result.current.lastExportResult).toEqual({
      outputFolderPath: '/tmp/workbook-output/exported',
      files: [
        '/tmp/workbook-output/exported/問題集_1級_一問一答_Workbook Test.pdf',
      ],
    });
  });

  it('PreviewWindow 起動後に ready まで状態を追従する', async () => {
    useWorkbookDraftStore.getState().actions.setStepThree({
      selectedOutputFolder: '/tmp/workbook-output',
    });
    // 抽選済み（clean）にしないと未抽選ブロッキングで canExport が立たない
    setDrawConditionChangeStatus('clean');

    const previewUpdate = createPreviewUpdate();
    vi.mocked(window.createPdfExport.getPreviewWindowStatus)
      .mockResolvedValueOnce({
        ok: true as const,
        status: CLOSED_STATUS,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        status: {
          isOpen: true,
          isReady: false,
          creationType: 'workbook',
          slotKey: 'grade:1:workbookMode:qaa',
          revision: 5,
          isRendering: true,
        },
      })
      .mockResolvedValueOnce({
        ok: true as const,
        status: {
          isOpen: true,
          isReady: false,
          creationType: 'workbook',
          slotKey: 'grade:1:workbookMode:qaa',
          revision: 5,
          isRendering: true,
        },
      })
      .mockResolvedValue({
        ok: true as const,
        status: {
          isOpen: true,
          isReady: true,
          creationType: 'workbook',
          slotKey: 'grade:1:workbookMode:qaa',
          revision: 5,
          isRendering: false,
        },
      });

    const { result } = renderHook(() => useTestTarget(previewUpdate));
    await act(async () => {});

    expect(result.current.canExportFromUi).toBe(false);

    await act(async () => {
      await result.current.requestManualCommit();
    });
    await act(async () => {});

    expect(window.createPdfExport.openPreviewWindow).toHaveBeenCalledWith({
      creationType: 'workbook',
      slotKey: 'grade:1:workbookMode:qaa',
    });

    expect(result.current.canExportFromUi).toBe(false);

    await waitFor(() => {
      expect(result.current.canExportFromUi).toBe(true);
    });

    expect(result.current.canExportFromUi).toBe(true);
  });

  it('出力できない理由を temp 向けに列挙する', async () => {
    const previewUpdate = createPreviewUpdate({ lastMeta: null });
    const { result } = renderHook(() => useTestTarget(previewUpdate));
    await act(async () => {});

    await waitFor(() => {
      expect(result.current.blockingReasons).toEqual(
        expect.arrayContaining([
          'まだ抽選が実行されていません。抽選を行ってください。',
          '出力先フォルダが指定されていません。出力先を指定してください。',
          'プレビューに最新の内容が反映されていません。',
          'プレビューウィンドウが閉じています。横のアイコンをクリックして再度開くことができます。',
        ]),
      );
    });
    expect(result.current.canExportFromUi).toBe(false);
  });

  it('空白だけの出力先は未選択として扱う', async () => {
    useWorkbookDraftStore.getState().actions.setStepThree({
      selectedOutputFolder: '   ',
    });

    const previewUpdate = createPreviewUpdate();
    vi.mocked(window.createPdfExport.getPreviewWindowStatus).mockResolvedValue({
      ok: true as const,
      status: {
        isOpen: true,
        isReady: true,
        creationType: 'workbook',
        slotKey: 'grade:1:workbookMode:qaa',
        revision: 5,
        isRendering: false,
      },
    });

    const { result } = renderHook(() => useTestTarget(previewUpdate));

    await waitFor(() => {
      expect(result.current.canExportFromUi).toBe(false);
      expect(result.current.blockingReasons).toContain(
        '出力先フォルダが指定されていません。出力先を指定してください。',
      );
    });
  });
});

import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPdfModeTransitionStore } from '../store/createPdfModeTransitionStore';
import { createPdfPreviewOrderStore } from '../store/createPdfPreviewOrderStore';
import useCreatePdfStatusRuntimeStore from '../store/useCreatePdfStatusRuntimeStore';
import { useCreatePdfModeTransition } from './useCreatePdfModeTransition';

const routerMock = vi.hoisted(() => ({
  pathname: '/createPdf/workbook',
  navigate: vi.fn(),
}));

const bridgeMock = vi.hoisted(() => ({
  closeCreatePdfPreviewWindow: vi.fn(),
  getCreatePdfPreviewWindowStatus: vi.fn(),
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: routerMock.pathname }),
  useNavigate: () => routerMock.navigate,
}));

vi.mock('@renderer/api/createPdfExportBridge', () => bridgeMock);

vi.mock('@renderer/api/pdfPreviewBridge', () => ({
  subscribeCreatePdfPreviewPatch: vi.fn(() => vi.fn()),
  subscribeCreatePdfPreviewUpdated: vi.fn(() => vi.fn()),
}));

describe('useCreatePdfModeTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerMock.pathname = '/createPdf/workbook';
    routerMock.navigate.mockClear();
    bridgeMock.closeCreatePdfPreviewWindow.mockReset();
    bridgeMock.getCreatePdfPreviewWindowStatus.mockReset();
    createPdfModeTransitionStore.getState().actions.reset();
    createPdfPreviewOrderStore.setActiveCreationType(null);
    createPdfPreviewOrderStore.clearSession();
    useCreatePdfStatusRuntimeStore.getState().actions.reset();
    useGlobalLoadingStore.getState().clear();
  });

  afterEach(() => {
    createPdfModeTransitionStore.getState().actions.reset();
    createPdfPreviewOrderStore.setActiveCreationType(null);
    createPdfPreviewOrderStore.clearSession();
    useCreatePdfStatusRuntimeStore.getState().actions.reset();
    useGlobalLoadingStore.getState().clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('PreviewWindow が開いている場合は閉じてから session を消し、遷移先 creationType に固定して navigate する', async () => {
    bridgeMock.getCreatePdfPreviewWindowStatus.mockResolvedValue({
      ok: true,
      status: {
        isOpen: true,
        isReady: false,
        isRendering: true,
        creationType: 'workbook',
        slotKey: 'grade:1',
        revision: 1,
      },
    });
    bridgeMock.closeCreatePdfPreviewWindow.mockResolvedValue({ ok: true });
    createPdfPreviewOrderStore.beginSession('old', 'workbook', 'grade:1');

    const { result } = renderHook(() => useCreatePdfModeTransition());

    await act(async () => {
      await result.current({ targetPath: '/createPdf/exam' });
    });

    expect(bridgeMock.getCreatePdfPreviewWindowStatus).toHaveBeenCalledTimes(1);
    expect(bridgeMock.closeCreatePdfPreviewWindow).toHaveBeenCalledTimes(1);
    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe('');
    expect(routerMock.navigate).toHaveBeenCalledWith('/createPdf/exam', {
      replace: undefined,
      state: undefined,
    });

    createPdfPreviewOrderStore.beginSession(
      'workbook-new',
      'workbook',
      'grade:1',
    );
    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe('');

    createPdfPreviewOrderStore.beginSession('exam-new', 'exam', 'grade:1');
    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe('exam-new');
  });

  it('export 中は status 取得前に遷移を拒否する', async () => {
    useCreatePdfStatusRuntimeStore.getState().actions.setIsExporting(true);
    const { result } = renderHook(() => useCreatePdfModeTransition());

    let transitionResult: Awaited<ReturnType<typeof result.current>> | null =
      null;
    await act(async () => {
      transitionResult = await result.current({
        targetPath: '/createPdf/exam',
      });
    });

    expect(transitionResult).toEqual({ ok: false, reason: 'exporting' });
    expect(bridgeMock.getCreatePdfPreviewWindowStatus).not.toHaveBeenCalled();
    expect(routerMock.navigate).not.toHaveBeenCalled();
    expect(useGlobalLoadingStore.getState().items).toHaveLength(0);
  });

  it('status 取得に失敗した場合は loading と遷移状態を解除する', async () => {
    bridgeMock.getCreatePdfPreviewWindowStatus.mockResolvedValue({
      ok: false,
      error: 'failed',
    });
    const { result } = renderHook(() => useCreatePdfModeTransition());

    let transitionResult: Awaited<ReturnType<typeof result.current>> | null =
      null;
    await act(async () => {
      transitionResult = await result.current({
        targetPath: '/createPdf/exam',
      });
    });

    expect(transitionResult).toEqual({ ok: false, reason: 'status-failed' });
    expect(createPdfModeTransitionStore.getState().isTransitioning).toBe(false);
    expect(useGlobalLoadingStore.getState().items).toHaveLength(0);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });
});

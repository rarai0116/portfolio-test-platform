import useGlobalLoadingStore from '@stores/useGlobalLoadingStore';
import { afterEach, describe, expect, it } from 'vitest';
import { createPdfModeTransitionStore } from './createPdfModeTransitionStore';

describe('createPdfModeTransitionStore', () => {
  afterEach(() => {
    createPdfModeTransitionStore.getState().actions.reset();
    useGlobalLoadingStore.getState().clear();
  });

  it('begin で遷移状態を開始し、complete で loading と状態を解除する', () => {
    const loadingId = useGlobalLoadingStore.getState().show('切替中');
    const transitionId = createPdfModeTransitionStore.getState().actions.begin({
      sourcePath: '/createPdf/workbook',
      targetPath: '/createPdf/exam',
      targetCreationType: 'exam',
      loadingId,
    });

    expect(createPdfModeTransitionStore.getState()).toMatchObject({
      isTransitioning: true,
      sourcePath: '/createPdf/workbook',
      targetPath: '/createPdf/exam',
      targetCreationType: 'exam',
      shouldRestorePreviewWindow: false,
    });
    expect(useGlobalLoadingStore.getState().items).toHaveLength(1);

    createPdfModeTransitionStore.getState().actions.complete(transitionId);

    expect(createPdfModeTransitionStore.getState().isTransitioning).toBe(false);
    expect(useGlobalLoadingStore.getState().items).toHaveLength(0);
  });

  it('consumeRestoreIntent は restore intent を一度だけ消費する', () => {
    const loadingId = useGlobalLoadingStore.getState().show('切替中');
    const transitionId = createPdfModeTransitionStore.getState().actions.begin({
      sourcePath: '/createPdf/workbook',
      targetPath: '/createPdf/exam',
      targetCreationType: 'exam',
      loadingId,
    });

    createPdfModeTransitionStore
      .getState()
      .actions.setShouldRestorePreviewWindow(transitionId, true);

    expect(
      createPdfModeTransitionStore.getState().actions.consumeRestoreIntent(),
    ).toBe(true);
    expect(
      createPdfModeTransitionStore.getState().actions.consumeRestoreIntent(),
    ).toBe(false);
  });
});

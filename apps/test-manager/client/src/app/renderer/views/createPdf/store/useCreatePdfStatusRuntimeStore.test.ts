import { describe, expect, it } from 'vitest';
import useCreatePdfStatusRuntimeStore from './useCreatePdfStatusRuntimeStore';

describe('useCreatePdfStatusRuntimeStore', () => {
  it('BFS 計算中状態を更新し、reset で解除する', () => {
    const { actions } = useCreatePdfStatusRuntimeStore.getState();
    actions.reset();

    actions.setIsBfsCalculating(true);
    expect(useCreatePdfStatusRuntimeStore.getState().isBfsCalculating).toBe(
      true,
    );

    actions.setIsBfsCalculating(false);
    expect(useCreatePdfStatusRuntimeStore.getState().isBfsCalculating).toBe(
      false,
    );

    actions.setIsBfsCalculating(true);
    actions.reset();
    expect(useCreatePdfStatusRuntimeStore.getState().isBfsCalculating).toBe(
      false,
    );
  });
});

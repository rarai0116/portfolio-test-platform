import { beforeEach, describe, expect, it, vi } from 'vitest';

const SIDEBAR_STORE_KEY = 'ui:sidebar:v1';

const loadSidebarStore = async () => {
  return import('./useSidebarStore');
};

describe('useSidebarStore', () => {
  beforeEach(() => {
    localStorage.removeItem(SIDEBAR_STORE_KEY);
    vi.resetModules();
  });

  it('setOpenは開閉状態をlocalStorageに永続化する', async () => {
    const { default: useSidebarStore } = await loadSidebarStore();

    useSidebarStore.getState().setOpen(false);

    const stored = localStorage.getItem(SIDEBAR_STORE_KEY);

    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toMatchObject({
      state: { open: false },
    });
  });

  it('保存済みの開閉状態を初期化時に復元できる', async () => {
    localStorage.setItem(
      SIDEBAR_STORE_KEY,
      JSON.stringify({
        state: { open: false },
        version: 0,
      }),
    );

    const { default: useSidebarStore } = await loadSidebarStore();

    expect(useSidebarStore.getState().open).toBe(false);
  });
});
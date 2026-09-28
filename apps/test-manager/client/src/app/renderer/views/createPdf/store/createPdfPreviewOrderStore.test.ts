import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPdfPreviewOrderStore } from './createPdfPreviewOrderStore';

vi.mock('@renderer/api/pdfPreviewBridge', () => ({
  subscribeCreatePdfPreviewPatch: vi.fn(() => vi.fn()),
  subscribeCreatePdfPreviewUpdated: vi.fn(() => vi.fn()),
}));

describe('createPdfPreviewOrderStore', () => {
  afterEach(() => {
    createPdfPreviewOrderStore.setActiveCreationType(null);
    createPdfPreviewOrderStore.clearSession();
  });

  it('clearSession で session 情報を初期化して通知する', () => {
    const listener = vi.fn();
    const unsubscribe = createPdfPreviewOrderStore.subscribe(listener);

    createPdfPreviewOrderStore.beginSession('session-1', 'workbook', 'grade:1');
    listener.mockClear();

    createPdfPreviewOrderStore.clearSession();

    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe('');
    expect(createPdfPreviewOrderStore.getSnapshot().sessionScope).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('activeCreationType と異なる beginSession を無視する', () => {
    createPdfPreviewOrderStore.setActiveCreationType('exam');

    createPdfPreviewOrderStore.beginSession('session-1', 'workbook', 'grade:1');

    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe('');
    expect(createPdfPreviewOrderStore.getSnapshot().sessionScope).toBeNull();

    createPdfPreviewOrderStore.beginSession('session-2', 'exam', 'grade:1');

    expect(createPdfPreviewOrderStore.getSnapshot().sessionId).toBe(
      'session-2',
    );
    expect(
      createPdfPreviewOrderStore.getSnapshot().sessionScope?.creationType,
    ).toBe('exam');
  });
});

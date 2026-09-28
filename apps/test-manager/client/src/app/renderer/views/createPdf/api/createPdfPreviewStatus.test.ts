import { describe, expect, it } from 'vitest';
import { deriveCreatePdfPreviewStatus } from './createPdfPreviewStatus';

describe('deriveCreatePdfPreviewStatus', () => {
  it('rendering reason を重複させない', () => {
    const status = deriveCreatePdfPreviewStatus({
      creationType: 'workbook',
      slotKey: 'slot-1',
      currentPreviewState: {
        creationType: 'workbook',
        slotKey: 'slot-1',
        revision: 3,
        issues: [
          {
            id: 'rendering',
            type: 'rendering',
            message: '描画中',
            phase: 'full-render',
          },
        ],
      },
      lastMeta: {
        creationType: 'workbook',
        slotKey: 'slot-1',
        revision: 3,
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      previewWindowStatus: {
        isOpen: true,
        isReady: true,
        isRendering: true,
        creationType: 'workbook',
        slotKey: 'slot-1',
        revision: 3,
      },
    });

    expect(
      status.reasons.filter((reason) => reason.code === 'preview-rendering'),
    ).toHaveLength(1);
  });

  it('blocking reason は優先順位で kind を選ぶ', () => {
    const status = deriveCreatePdfPreviewStatus({
      creationType: 'workbook',
      slotKey: 'slot-1',
      currentPreviewState: null,
      lastMeta: null,
      previewWindowStatus: {
        isOpen: false,
        isReady: false,
        isRendering: false,
        creationType: null,
        slotKey: null,
        revision: null,
      },
    });

    expect(status.kind).toBe('closed');
  });

  it('初回プレビュー更新中は未更新より更新中を優先する', () => {
    const status = deriveCreatePdfPreviewStatus({
      creationType: 'workbook',
      slotKey: 'slot-1',
      currentPreviewState: null,
      lastMeta: null,
      isCommitting: true,
      previewWindowStatus: {
        isOpen: true,
        isReady: true,
        isRendering: false,
        creationType: 'workbook',
        slotKey: 'slot-1',
        revision: 1,
      },
    });

    expect(status.kind).toBe('committing');
  });
});

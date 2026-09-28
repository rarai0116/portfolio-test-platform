import type { CreatePdfPreviewCacheMeta } from '@shared/types/pdfPreview';
import { describe, expect, it } from 'vitest';
import {
  isCreatePdfJsonImportPreviewCompleted,
  isCreatePdfJsonImportPreviewWaitSkippable,
} from './useLoadConditionJson';

const lastMeta: CreatePdfPreviewCacheMeta = {
  creationType: 'exam',
  slotKey: 'grade:1',
  revision: 2,
  updatedAt: 'updated-at',
};

const completedInput = {
  baselineRevision: 1,
  isCommitting: false,
  isJsonLoading: false,
  lastMeta,
  previewWindowStatus: {
    isOpen: true,
    isReady: true,
    creationType: 'exam' as const,
    slotKey: 'grade:1',
    revision: 2,
    isRendering: false,
  },
};

describe('isCreatePdfJsonImportPreviewCompleted', () => {
  it('対象revisionの描画が完了した場合にtrueを返す', () => {
    expect(isCreatePdfJsonImportPreviewCompleted(completedInput)).toBe(true);
  });

  it('インポート前と同じrevisionは完了扱いにしない', () => {
    expect(
      isCreatePdfJsonImportPreviewCompleted({
        ...completedInput,
        baselineRevision: 2,
      }),
    ).toBe(false);
  });

  it('commit中・rendering中・revision不一致では完了扱いにしない', () => {
    expect(
      isCreatePdfJsonImportPreviewCompleted({
        ...completedInput,
        isCommitting: true,
      }),
    ).toBe(false);
    expect(
      isCreatePdfJsonImportPreviewCompleted({
        ...completedInput,
        previewWindowStatus: {
          ...completedInput.previewWindowStatus,
          isRendering: true,
        },
      }),
    ).toBe(false);
    expect(
      isCreatePdfJsonImportPreviewCompleted({
        ...completedInput,
        previewWindowStatus: {
          ...completedInput.previewWindowStatus,
          revision: 3,
        },
      }),
    ).toBe(false);
  });
});

describe('isCreatePdfJsonImportPreviewWaitSkippable', () => {
  it('commit後にプレビューウィンドウが閉じている場合は描画待ちをスキップできる', () => {
    expect(
      isCreatePdfJsonImportPreviewWaitSkippable({
        ...completedInput,
        previewWindowStatus: {
          isOpen: false,
          isReady: false,
          creationType: null,
          slotKey: null,
          revision: null,
          isRendering: false,
        },
      }),
    ).toBe(true);
  });

  it('commit前やcommit中は閉じていても描画待ちをスキップしない', () => {
    const closedPreviewWindowStatus = {
      isOpen: false,
      isReady: false,
      creationType: null,
      slotKey: null,
      revision: null,
      isRendering: false,
    };

    expect(
      isCreatePdfJsonImportPreviewWaitSkippable({
        ...completedInput,
        baselineRevision: 2,
        previewWindowStatus: closedPreviewWindowStatus,
      }),
    ).toBe(false);
    expect(
      isCreatePdfJsonImportPreviewWaitSkippable({
        ...completedInput,
        isCommitting: true,
        previewWindowStatus: closedPreviewWindowStatus,
      }),
    ).toBe(false);
  });
});

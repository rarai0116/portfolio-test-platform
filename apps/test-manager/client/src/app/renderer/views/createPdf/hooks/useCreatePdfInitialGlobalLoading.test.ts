import type { PreviewCommitGuardReason } from '@views/createPdf/api/createPdfPreviewCommitKey';
import type { CreatePdfPreviewStatusKind } from '@views/createPdf/types/statusState';
import { describe, expect, it } from 'vitest';
import { resolveInitialLoadingMessage } from './useCreatePdfInitialGlobalLoading';

const baseInput = {
  activeGuardReasons: [] as PreviewCommitGuardReason[],
  hasCommitKey: true,
  isCommitting: false,
  isInitialStateSettled: true,
  isLoadingTestData: false,
  lastMetaCreationType: null,
  lastMetaRevision: null,
  lastMetaSlotKey: null,
  previewWindowCreationType: null,
  previewWindowIsOpen: false,
  previewWindowIsReady: false,
  previewWindowIsRendering: false,
  previewWindowRevision: null,
  previewWindowSlotKey: null,
  previewStatusKind: 'not-updated' as CreatePdfPreviewStatusKind,
};

describe('resolveInitialLoadingMessage', () => {
  it('問題テーブルのblocking guardがある場合はプレビュー準備待ちをスキップする', () => {
    const message = resolveInitialLoadingMessage({
      ...baseInput,
      activeGuardReasons: [
        {
          id: 'test-table-blocking-error',
          message: '問題テーブルにエラーがあるためプレビュー更新を保留します。',
        },
      ],
    });

    expect(message).toBeNull();
  });

  it('blocking guardがない場合は従来どおりプレビュー準備待ちにする', () => {
    const message = resolveInitialLoadingMessage(baseInput);

    expect(message).toBe('プレビューを準備中…');
  });

  it('問題データ読込中は問題テーブルblockingより優先して待機する', () => {
    const message = resolveInitialLoadingMessage({
      ...baseInput,
      isLoadingTestData: true,
      activeGuardReasons: [
        {
          id: 'test-table-blocking-error',
          message: '問題テーブルにエラーがあるためプレビュー更新を保留します。',
        },
      ],
    });

    expect(message).toBe('問題データを読み込み中…');
  });
});

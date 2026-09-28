import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  CreatePdfPersistedDocument,
  CreatePdfPreviewCommitInput,
} from '@shared/types/pdfPreview';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- 作業用 tmpDir ---
let tmpDir: string;
let stateDir: string;

// --- electron だけモック（app.getPath は tmpDir を返す） ---
// vi.hoisted で getPath の参照を先に確保し、後で tmpDir へ向ける
const { getPathMock, getAllWindowsMock } = vi.hoisted(() => ({
  getPathMock: vi.fn(() => ''),
  getAllWindowsMock: vi.fn(() => [] as unknown[]),
}));

vi.mock('electron', () => ({
  app: { getPath: getPathMock },
  BrowserWindow: { getAllWindows: getAllWindowsMock },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// --- セットアップ ---
beforeEach(async () => {
  tmpDir = join(tmpdir(), `pdfPreview-test-${Date.now()}`);
  stateDir = join(tmpDir, 'create-pdf-state');
  await mkdir(stateDir, { recursive: true });
  getPathMock.mockReturnValue(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

/** テスト用 commit 入力の最小構成ファクトリ */
const makeCommitInput = (
  slotKey = 'grade:1',
  grade: 1 | 2 = 1,
): CreatePdfPreviewCommitInput => ({
  creationType: 'exam',
  slotKey,
  document: {
    schemaVersion: 1,
    creationType: 'exam',
    revision: 0,
    updatedAt: '',
    slots: {
      [slotKey]: {
        scope: { grade, workbookMode: null },
        restoreState: null,
        previewSnapshot: null,
        updatedAt: '',
      },
    },
  } as CreatePdfPersistedDocument,
});

/** 各テストで新しいハンドラを登録して返す */
const setupHandlers = async () => {
  vi.resetModules();
  const handlers = new Map<
    string,
    (_evt: unknown, ...args: unknown[]) => Promise<unknown>
  >();

  // ipcMain.handle の実装を差し込む（resetModules 後に再評価）
  const { ipcMain } = await import('electron');
  vi.mocked(ipcMain.handle).mockImplementation(
    (channel: string, cb: unknown) => {
      handlers.set(channel, cb as Parameters<typeof handlers.set>[1]);
    },
  );

  const { registerPdfPreviewIpc } = await import('./pdfPreview');
  registerPdfPreviewIpc();
  return handlers;
};

describe('registerPdfPreviewIpc', () => {
  describe('commit ハンドラ', () => {
    it('新規ファイルの場合 revision=1 で保存する', async () => {
      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:commit');
      expect(handler).toBeDefined();

      if (!handler) {
        throw new Error('Handler for pdfPreview:commit is not registered');
      }
      const result = await handler({}, makeCommitInput());

      expect(result).toMatchObject({ ok: true, meta: { revision: 1 } });
    });

    it('既存ファイルがある場合 revision を +1 する', async () => {
      const existing: CreatePdfPersistedDocument = {
        schemaVersion: 1,
        creationType: 'exam',
        revision: 3,
        updatedAt: '2026-01-01T00:00:00.000Z',
        slots: {},
      };
      await writeFile(
        join(stateDir, 'exam.json'),
        JSON.stringify(existing),
        'utf-8',
      );

      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:commit');
      if (!handler) {
        throw new Error('Handler for pdfPreview:commit is not registered');
      }
      const result = await handler({}, makeCommitInput());

      expect(result).toMatchObject({ ok: true, meta: { revision: 4 } });
    });

    it('meta に creationType / slotKey が含まれる', async () => {
      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:commit');
      if (!handler) {
        throw new Error('Handler for pdfPreview:commit is not registered');
      }
      const result = await handler({}, makeCommitInput('grade:2', 2));

      expect(result).toMatchObject({
        ok: true,
        meta: { creationType: 'exam', slotKey: 'grade:2' },
      });
    });

    it('commit した slot を lastActive として保存する', async () => {
      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:commit');
      if (!handler) {
        throw new Error('Handler for pdfPreview:commit is not registered');
      }
      const slotKey = 'grade:2';
      const result = await handler({}, makeCommitInput(slotKey, 2));

      expect(result).toMatchObject({ ok: true });
      const raw = await readFile(join(stateDir, 'exam.json'), 'utf-8');
      const saved = JSON.parse(raw) as CreatePdfPersistedDocument;
      expect(saved.lastActiveSlotKey).toBe(slotKey);
      expect(saved.lastActiveScope).toEqual({ grade: 2, workbookMode: null });
    });
  });

  describe('read ハンドラ', () => {
    it('ファイルが存在する場合は文書を返す', async () => {
      const doc: CreatePdfPersistedDocument = {
        schemaVersion: 1,
        creationType: 'exam',
        revision: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        slots: {},
      };
      await writeFile(
        join(stateDir, 'exam.json'),
        JSON.stringify(doc),
        'utf-8',
      );

      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:read');
      if (!handler) {
        throw new Error('Handler for pdfPreview:read is not registered');
      }
      const result = await handler({}, 'exam');

      expect(result).toMatchObject({ ok: true, document: { revision: 2 } });
    });

    it('ファイルが存在しない場合は ok:false を返す', async () => {
      const handlers = await setupHandlers();
      const handler = handlers.get('pdfPreview:read');
      if (!handler) {
        throw new Error('Handler for pdfPreview:read is not registered');
      }
      const result = await handler({}, 'exam');

      expect(result).toMatchObject({ ok: false });
    });
  });
});

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type CreatePdfPersistedDocument,
  type CreatePdfPreviewCacheMeta,
  type CreatePdfPreviewCommitInput,
  type CreatePdfPreviewCommitResult,
  type CreatePdfPreviewPatchPayload,
  type CreatePdfPreviewReadResult,
  type CreatePdfPreviewRefreshResult,
  type CreationType,
  PdfPreviewChannels,
} from '@shared/types/pdfPreview';
import { app, BrowserWindow, ipcMain } from 'electron';

// T45-1: creationType から保存先パスを決定的に解決する。
// 外部には公開せず、このモジュール内部の helper に留める。
const getStateDir = (): string =>
  join(app.getPath('userData'), 'create-pdf-state');

const resolveDocumentPath = (creationType: CreationType): string =>
  join(getStateDir(), `${creationType}.json`);

const readDocument = async (
  creationType: CreationType,
): Promise<CreatePdfPersistedDocument | null> => {
  try {
    const raw = await readFile(resolveDocumentPath(creationType), 'utf-8');
    return JSON.parse(raw) as CreatePdfPersistedDocument;
  } catch {
    return null;
  }
};

const persistDocument = async (
  doc: CreatePdfPersistedDocument,
): Promise<void> => {
  await mkdir(getStateDir(), { recursive: true });
  await writeFile(
    resolveDocumentPath(doc.creationType),
    JSON.stringify(doc, null, 2),
    'utf-8',
  );
};

const broadcastUpdated = (meta: CreatePdfPreviewCacheMeta): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(PdfPreviewChannels.updated, meta);
  }
};

// T45-2 + T46-1: IPC ハンドラを登録する。
export function registerPdfPreviewIpc(): void {
  ipcMain.removeHandler(PdfPreviewChannels.commit);
  ipcMain.removeHandler(PdfPreviewChannels.refresh);
  ipcMain.removeHandler(PdfPreviewChannels.read);
  ipcMain.removeHandler(PdfPreviewChannels.patch);

  // commit: 対象 slot だけを上書きして文書単位の revision を更新する
  ipcMain.handle(
    PdfPreviewChannels.commit,
    async (
      _evt,
      input: CreatePdfPreviewCommitInput,
    ): Promise<CreatePdfPreviewCommitResult> => {
      try {
        const { creationType, slotKey, document: incoming } = input;
        const existing = await readDocument(creationType);
        const now = new Date().toISOString();
        const revision = (existing?.revision ?? 0) + 1;
        const incomingSlot = incoming.slots[slotKey];
        if (!incomingSlot) {
          return {
            ok: false,
            error: `保存対象 slot が見つかりません: ${slotKey}`,
          };
        }

        const updated: CreatePdfPersistedDocument = {
          schemaVersion: 1,
          creationType,
          revision,
          updatedAt: now,
          lastActiveSlotKey: slotKey,
          lastActiveScope: incomingSlot?.scope,
          slots: {
            ...(existing?.slots ?? {}),
            [slotKey]: {
              ...incomingSlot,
              updatedAt: now,
            },
          },
        };

        await persistDocument(updated);

        const meta: CreatePdfPreviewCacheMeta = {
          creationType,
          slotKey,
          revision,
          updatedAt: now,
        };
        broadcastUpdated(meta);
        return { ok: true, meta };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  // refresh: 最新 revision のメタだけを再通知する。snapshot 本体は返さない。
  ipcMain.handle(
    PdfPreviewChannels.refresh,
    async (
      _evt,
      creationType: CreationType,
      slotKey: string,
    ): Promise<CreatePdfPreviewRefreshResult> => {
      try {
        const doc = await readDocument(creationType);
        if (!doc) {
          return { ok: false, error: '保存文書が存在しません' };
        }
        const meta: CreatePdfPreviewCacheMeta = {
          creationType,
          slotKey,
          revision: doc.revision,
          updatedAt: doc.updatedAt,
        };
        broadcastUpdated(meta);
        return { ok: true, meta };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  // read: creationType から保存文書全体を返す。任意 path read は公開しない。
  ipcMain.handle(
    PdfPreviewChannels.read,
    async (
      _evt,
      creationType: CreationType,
    ): Promise<CreatePdfPreviewReadResult> => {
      try {
        const doc = await readDocument(creationType);
        if (!doc) {
          return { ok: false, error: '保存文書が存在しません' };
        }
        // T29 マイグレーション: version フィールドがない旧スキーマ (CreatePdfRestoreState) は null に差し替える
        for (const slot of Object.values(doc.slots)) {
          if (
            slot.restoreState != null &&
            typeof (slot.restoreState as { version?: unknown }).version ===
              'undefined'
          ) {
            slot.restoreState = null;
          }
        }
        return { ok: true, document: doc };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );

  // patch: 今回は送受信導線のみ。受け取って全 window へ中継する。
  // payload の加工・DOM 反映は後続タスクで実装する。
  ipcMain.handle(
    PdfPreviewChannels.patch,
    async (
      _evt,
      payload: CreatePdfPreviewPatchPayload,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        for (const win of BrowserWindow.getAllWindows()) {
          if (win.isDestroyed()) continue;
          win.webContents.send(PdfPreviewChannels.patch, payload);
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  );
}

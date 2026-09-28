import { EditorChannels, type EditorInsertPayload } from '@shared/types/editor';
import { type BrowserWindow, ipcMain } from 'electron';

export function registerEditorIpc(mainWindow: BrowserWindow) {
  ipcMain.removeHandler(EditorChannels.insert);

  // 画像挿入要求（Renderer -> Main）。Main は全 Renderer にブロードキャスト
  ipcMain.handle(
    EditorChannels.insert,
    async (
      _evt,
      payload: EditorInsertPayload,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        // 必須チェック
        if (!payload?.grade || !payload?.key) {
          return { ok: false, error: 'grade と key は必須です' };
        }
        // パネル間配信（フロート化しても main から配る）
        mainWindow.webContents.send(EditorChannels.insert, payload);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    },
  );
}

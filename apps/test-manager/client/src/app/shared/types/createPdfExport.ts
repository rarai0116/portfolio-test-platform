import type { CreatePdfConditionJson } from '@shared/types/createPdfConditionJson';
import type { CreationType } from '@shared/types/pdfPreview';

export const CreatePdfExportChannels = {
  openPreviewWindow: 'createPdfExport:openPreviewWindow',
  closePreviewWindow: 'createPdfExport:closePreviewWindow',
  getPreviewWindowStatus: 'createPdfExport:getPreviewWindowStatus',
  selectOutputDirectory: 'createPdfExport:selectOutputDirectory',
  exportPdf: 'createPdfExport:exportPdf',
  loadConditionJson: 'createPdfExport:loadConditionJson',
  requestPreviewUpdate: 'createPdfExport:requestPreviewUpdate',
  // main → renderer への push 通知: プレビューウィンドウが閉じられた
  previewWindowClosed: 'createPdfExport:previewWindowClosed',
  // main → renderer への push 通知: PreviewWindow から更新が要求された
  previewUpdateRequested: 'createPdfExport:previewUpdateRequested',
} as const;

export type CreatePdfExportPreviewWindowOpenRequest = {
  creationType: CreationType;
  slotKey: string;
};

export type CreatePdfExportPreviewWindowOpenResult =
  | { ok: true; reused: boolean }
  | { ok: false; error: string };

export type CreatePdfExportPreviewWindowCloseResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreatePdfExportPreviewWindowStatus = {
  isOpen: boolean;
  isReady: boolean;
  creationType: CreationType | null;
  slotKey: string | null;
  revision: number | null;
  isRendering: boolean;
};

export type CreatePdfExportPreviewWindowStatusResult =
  | { ok: true; status: CreatePdfExportPreviewWindowStatus }
  | { ok: false; error: string };

export type CreatePdfExportPreviewUpdateRequest = {
  creationType: CreationType;
  slotKey: string;
};

export type CreatePdfExportPreviewUpdateRequestResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreatePdfExportPagesRange = {
  start: number;
  end: number;
};

export type CreatePdfExportManifestOptions = {
  includeCover?: boolean;
  includeMiddleCover?: boolean;
};

export type CreatePdfExportUnit = {
  unitId: string;
  kind: 'workbook' | 'exam-question' | 'exam-answer';
  groupId: string;
  fileName: string;
  pagesRange?: CreatePdfExportPagesRange;
  pagesRanges?: CreatePdfExportPagesRange[];
};

export type CreatePdfExportManifest = {
  creationType: CreationType;
  slotKey: string;
  revision: number;
  title: string;
  units: CreatePdfExportUnit[];
};

export type CreatePdfExportManifestResult =
  | { ok: true; manifest: CreatePdfExportManifest }
  | { ok: false; error: string };

export type CreatePdfSelectOutputDirectoryRequest = {
  defaultPath?: string | null;
};

export type CreatePdfSelectOutputDirectoryResult =
  | { ok: true; selectedPath: string | null }
  | { ok: false; error: string };

export type CreatePdfExportRequest = {
  creationType: CreationType;
  slotKey: string;
  expectedRevision: number;
  outputDirectory: string;
  includeCover: boolean;
  includeMiddleCover?: boolean;
  /** 出題条件JSON。null または未指定の場合はファイルを保存しない */
  conditionJson?: CreatePdfConditionJson | null;
};

export type CreatePdfExportResult =
  | {
      ok: true;
      outputFolderPath: string;
      files: string[];
    }
  | { ok: false; error: string };

/** ダイアログ経由（mode:'dialog'）またはパス直接指定（mode:'path'）の両方をサポート。 */
export type CreatePdfLoadConditionJsonRequest =
  | { mode: 'dialog' }
  | { mode: 'path'; filePath: string };

/** filePath は反対モード遷移（§3.4）で再読込に使用するため常に返す。 */
export type CreatePdfLoadConditionJsonResult =
  | { ok: true; json: unknown; filePath: string }
  | { ok: false; error: string; cancelled?: true };

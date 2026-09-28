import type {
  answerEditorType,
  questionEditorType,
  TestSubject,
} from '@shared/types/contracts';
import type {
  CreatePdfConditionJson,
  ExamDateOption,
} from '@shared/types/createPdfConditionJson';

export const PdfPreviewChannels = {
  commit: 'pdfPreview:commit',
  refresh: 'pdfPreview:refresh',
  updated: 'pdfPreview:updated',
  patch: 'pdfPreview:patch',
  read: 'pdfPreview:read',
} as const;

export type CreationType = 'exam' | 'workbook';

export type CreatePdfWorkbookMode =
  | 'multipleChoice'
  | 'qaa'
  | 'qaaAllTrue'
  | 'qaaAllFalse';

export type CreatePdfPersistScope = {
  grade: 1 | 2;
  // exam の場合は null。workbook の場合は出題形式を指定する。
  workbookMode: CreatePdfWorkbookMode | null;
};

/**
 * creationType と grade / workbookMode から slotKey を決定的に生成する。
 * commit 側と read 側で同一の関数を使うことで不一致を防ぐ。
 */
export const buildSlotKey = (scope: CreatePdfPersistScope): string => {
  if (scope.workbookMode === null) {
    return `grade:${scope.grade}`;
  }
  return `grade:${scope.grade}:workbookMode:${scope.workbookMode}`;
};

export type CreatePdfPreviewCacheMeta = {
  creationType: CreationType;
  slotKey: string;
  revision: number;
  updatedAt: string;
};

// --- RestoreState: T29 で CreatePdfConditionJson に統一 ---
// CreatePdfCommonPersistedState / CreatePdfRestoreState 等の旧型は T29 で削除済み。

// --- PreviewSnapshot ---

export type CreatePdfPreviewLayout = {
  pageSize: 'A4' | 'B5';
  hasCover: boolean;
  hasSubCategoryHeading: boolean;
};

export type CreatePdfPreviewItem = {
  itemId: string;
  sourceNo: number;
  sourceKind: 'existing' | 'original';
  subject?: TestSubject;
  bigCategoryTag?: string;
  smallCategoryTag?: string;
  nengo?: string;
  year?: string;
  testNo?: string;
  publicationYear?: string;
  publicationNo?: string;
  difficult?: number;
  questionHtml: string;
  questionChoicesHtml?: string[];
  answerHtml: string;
  answerChoicesHtml?: string[];
  answerBool?: boolean;
  answerNo?: string;
  forcePageBreak?: boolean;
  questionEditorType?: questionEditorType;
  answerEditorType?: answerEditorType;
  isSerialNumber?: boolean;
  // 0 または undefined の場合はシャッフルしない（buildItem で確定済み）
  shuffleSeed?: number;
};

export type CreatePdfPreviewImageRef = {
  grade: 'firstGrade' | 'secondGrade';
  key: string;
  // 最新追従方針のため必須ではないが、updatedAt を保持して差分検知に備える
  updatedAt?: string;
  width?: number;
  height?: number;
  objectPath?: string;
};

export type CreatePdfPreviewSnapshot = {
  schemaVersion: 1;
  creationType: 'exam' | 'workbook';
  /** workbook のとき出題形式。exam のとき null */
  workbookMode: CreatePdfWorkbookMode | null;
  grade: 1 | 2;
  title: string;
  layout: CreatePdfPreviewLayout;
  items: CreatePdfPreviewItem[];
  imageRefs: CreatePdfPreviewImageRef[];
  generatedAt: string;
  // optional: 既存保存データとの後方互換を保つため
  isShuffleChoices?: boolean;
  shuffleSeed?: number | null;
  /** exam の表紙表示用。旧 snapshot 互換のため optional。 */
  examDate?: ExamDateOption;
};

// --- PersistedDocument ---

export type CreatePdfPersistedSlot = {
  scope: CreatePdfPersistScope;
  restoreState: CreatePdfConditionJson | null;
  previewSnapshot: CreatePdfPreviewSnapshot | null;
  updatedAt: string;
};

export type CreatePdfPersistedDocument = {
  schemaVersion: 1;
  creationType: CreationType;
  revision: number;
  updatedAt: string;
  lastActiveSlotKey?: string;
  lastActiveScope?: CreatePdfPersistScope;
  slots: Record<string, CreatePdfPersistedSlot>;
};

// --- IPC 入出力型 ---

export type CreatePdfPreviewCommitInput = {
  creationType: CreationType;
  slotKey: string;
  document: CreatePdfPersistedDocument;
};

export type CreatePdfPreviewCommitResult =
  | { ok: true; meta: CreatePdfPreviewCacheMeta }
  | { ok: false; error: string };

export type CreatePdfPreviewRefreshResult =
  | { ok: true; meta: CreatePdfPreviewCacheMeta }
  | { ok: false; error: string };

export type CreatePdfPreviewUpdatedEvent = CreatePdfPreviewCacheMeta;

export type CreatePdfPreviewPatchPayload = {
  creationType: CreationType;
  slotKey: string;
  patchType: 'image';
  imageKeys: string[];
};

export type CreatePdfPreviewReadResult =
  | { ok: true; document: CreatePdfPersistedDocument }
  | { ok: false; error: string };

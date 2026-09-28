import type { CreationType as _CreationType } from '@shared/types/pdfPreview';
import type { ExamState, WorkbookState } from './draftState';
import type {
  TestTableRow,
  TestTableSection,
  TestTableStoreSnapshot,
} from './testTable';
// 共通画面で扱う作成種別の正本。
export type CreationType = _CreationType;
export type CreatePdfRouteMode = CreationType | 'tempExam' | 'tempWorkbook';

export const isWorkbookRouteMode = (
  mode: CreatePdfRouteMode,
): mode is 'workbook' | 'tempWorkbook' =>
  mode === 'workbook' || mode === 'tempWorkbook';

export const isExamRouteMode = (
  mode: CreatePdfRouteMode,
): mode is 'exam' | 'tempExam' => mode === 'exam' || mode === 'tempExam';

// 取得対象データを切り替えるための級指定。
export type Grade = 1 | 2;

export type CreatePdfPreviewIssue =
  | {
      id: string;
      type: 'rendering';
      message: string;
      phase: 'read' | 'full-render' | 'patch-queue';
    }
  | {
      id: string;
      type: 'loading-image';
      message: string;
      imageKeys: string[];
      itemIds?: string[];
    }
  | {
      id: string;
      type: 'failed-image';
      message: string;
      imageKeys: string[];
      itemIds?: string[];
    }
  | {
      id: string;
      type: 'image-dimension-unresolved';
      message: string;
      imageKeys: string[];
      itemIds?: string[];
    }
  | {
      id: string;
      type: 'katex-error';
      message: string;
      itemIds?: string[];
    }
  | {
      id: string;
      type: 'unexpected-error';
      message: string;
      stage: 'cache-read' | 'iframe' | 'render' | 'patch';
      itemIds?: string[];
    };

export type CreatePdfCurrentPreviewState = {
  creationType: CreationType;
  slotKey: string;
  revision: number;
  issues: CreatePdfPreviewIssue[];
};

export type CreatePdfPreviewHealth = {
  hasRendering: boolean;
  hasLoading: boolean;
  hasFailedImage: boolean;
  hasKaTeXError: boolean;
  hasAnyError: boolean;
  isHealthy: boolean;
};

export const getCreatePdfPreviewHealth = (
  state: CreatePdfCurrentPreviewState | null,
): CreatePdfPreviewHealth => {
  const issues = state?.issues ?? [];
  const hasRendering = issues.some((issue) => issue.type === 'rendering');
  const hasLoading = issues.some((issue) => issue.type === 'loading-image');
  const hasFailedImage = issues.some((issue) => issue.type === 'failed-image');
  const hasKaTeXError = issues.some((issue) => issue.type === 'katex-error');
  const hasAnyError = issues.some((issue) => issue.type === 'unexpected-error');

  return {
    hasRendering,
    hasLoading,
    hasFailedImage,
    hasKaTeXError,
    hasAnyError,
    isHealthy:
      !hasRendering &&
      !hasLoading &&
      !hasFailedImage &&
      !hasKaTeXError &&
      !hasAnyError,
  };
};

// 画面全体で共有する最小の業務 state。
export type CreatePdfViewState = {
  creationType: CreationType;
  grade: Grade;
  title: string;
  selectedOutputFolder: string | null;
  isDirtyConditions: boolean;
  currentPreviewState: CreatePdfCurrentPreviewState | null;
  actions: {
    setCreationType: (value: CreationType) => void;
    setGrade: (value: Grade) => void;
    setTitle: (value: string) => void;
    setSelectedOutputFolder: (value: string | null) => void;
    markDirty: () => void;
    clearDirty: () => void;
    setCurrentPreviewState: (
      value: CreatePdfCurrentPreviewState | null,
    ) => void;
    replacePreviewIssues: (issues: CreatePdfPreviewIssue[]) => void;
    upsertPreviewIssue: (issue: CreatePdfPreviewIssue) => void;
    removePreviewIssue: (issueId: string) => void;
    clearPreviewIssues: () => void;
    reset: () => void;
  };
};

export type CreatePdfCommonState = Omit<
  CreatePdfViewState,
  'actions' | 'currentPreviewState'
>;

// 模擬試験モードの最小受け皿。詳細は後続タスクで増減を許容する。
export type ExamViewState = {
  tableSections: TestTableSection[];
  actions: {
    replaceTableSections: (value: TestTableSection[]) => void;
    reset: () => void;
  };
};

export type ExamViewValues = Omit<ExamViewState, 'actions'>;

// 問題集モード内の出題形式。
export type WorkbookMode =
  | 'qaa'
  | 'qaaAllTrue'
  | 'qaaAllFalse'
  | 'multipleChoice';

// 初期テーブル生成に使う条件行。
export type WorkbookCategoryTableRow = {
  id: string;
  subject: string | null;
  bigCategoryTag: string | null;
  smallCategoryTag: string | null;
  count: number;
};

// 問題集モードで共有する業務 state。
export type WorkbookViewState = {
  workbookMode: WorkbookMode;
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
  restoreMode: 'conditions' | 'fixedNos' | null;
  categoryTable: WorkbookCategoryTableRow[];
  tableRows: TestTableRow[];
  actions: {
    setWorkbookMode: (value: WorkbookMode) => void;
    setExcludedTagIds: (value: string[]) => void;
    setExcludePastExam: (value: boolean) => void;
    setExcludeOriginal: (value: boolean) => void;
    setShuffleChoices: (value: boolean) => void;
    setShuffleSeed: (value: number | null) => void;
    setRestoreMode: (value: 'conditions' | 'fixedNos' | null) => void;
    replaceCategoryConditions: (value: WorkbookCategoryTableRow[]) => void;
    replaceTableRows: (value: TestTableRow[]) => void;
    reset: () => void;
  };
};

export type WorkbookViewValues = Omit<WorkbookViewState, 'actions'>;

export type CreatePdfInitialLoadSource = 'json' | 'savedState' | 'initialState';

export const createPdfInitialLoadPriority = [
  'json',
  'savedState',
  'initialState',
] as const satisfies readonly CreatePdfInitialLoadSource[];

export type CreatePdfRouteSnapshot = {
  common: CreatePdfCommonState;
  exam?: ExamState;
  workbook?: WorkbookState;
  testTable?: TestTableStoreSnapshot;
};

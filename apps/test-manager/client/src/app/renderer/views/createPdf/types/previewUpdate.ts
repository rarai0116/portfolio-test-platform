import type { CreatePdfPreviewCacheMeta } from '@shared/types/pdfPreview';
import type { PreviewCommitGuardReason } from '@views/createPdf/api/createPdfPreviewCommitKey';
import type { CreatePdfPreviewIssue } from './viewState';

export type CreatePdfPreviewUpdateStatus = {
  isCommitting: boolean;
  isLoadingTestData: boolean;
  hasCommitKey: boolean;
  lastMeta: CreatePdfPreviewCacheMeta | null;
  activeGuardReasons: PreviewCommitGuardReason[];
  issues: CreatePdfPreviewIssue[];
};

export type CreatePdfPreviewUpdateAdapter = CreatePdfPreviewUpdateStatus & {
  requestManualCommit: () => Promise<void>;
  setGradeChangeDialogOpen: (value: boolean) => void;
  beginGuardedEdit: (editKey: string) => void;
  endGuardedEdit: (editKey: string) => void;
};

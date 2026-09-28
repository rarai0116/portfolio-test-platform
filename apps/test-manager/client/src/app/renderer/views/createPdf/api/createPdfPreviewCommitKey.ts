import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import type { TestTableSection } from '@views/createPdf/types/testTable';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

export type PreviewCommitGuardReasonId =
  | 'test-data-loading'
  | 'grade-change-dialog'
  | 'json-loading'
  | 'reset-pending'
  | 'table-editing'
  | 'test-table-blocking-error';

export type PreviewCommitGuardReason = {
  id: PreviewCommitGuardReasonId;
  message: string;
};

export type PreviewCommitGuardInput = {
  isLoadingTestData: boolean;
  isGradeChangeDialogOpen: boolean;
  isJsonLoading: boolean;
  isResetPending: boolean;
  isTableEditing: boolean;
  hasBlockingTestTableError: boolean;
};

type PreviewCommitGuardEvaluator = (
  input: PreviewCommitGuardInput,
) => PreviewCommitGuardReason | null;

const guardEvaluators: readonly PreviewCommitGuardEvaluator[] = [
  (input) =>
    input.isLoadingTestData
      ? {
          id: 'test-data-loading',
          message: '問題データ読込中はプレビュー更新を保留します。',
        }
      : null,
  (input) =>
    input.isGradeChangeDialogOpen
      ? {
          id: 'grade-change-dialog',
          message: '級変更確認中はプレビュー更新を保留します。',
        }
      : null,
  (input) =>
    input.isJsonLoading
      ? {
          id: 'json-loading',
          message: 'JSON読込中はプレビュー更新を保留します。',
        }
      : null,
  (input) =>
    input.isResetPending
      ? {
          id: 'reset-pending',
          message: 'リセット確認中はプレビュー更新を保留します。',
        }
      : null,
  (input) =>
    input.isTableEditing
      ? {
          id: 'table-editing',
          message: '問題テーブル編集中はプレビュー更新を保留します。',
        }
      : null,
  (input) =>
    input.hasBlockingTestTableError
      ? {
          id: 'test-table-blocking-error',
          message: '問題テーブルにエラーがあるためプレビュー更新を保留します。',
        }
      : null,
] as const;

export const buildActivePreviewCommitGuardReasons = (
  input: PreviewCommitGuardInput,
): PreviewCommitGuardReason[] =>
  guardEvaluators.flatMap((evaluate) => {
    const reason = evaluate(input);
    return reason ? [reason] : [];
  });

const createPreviewTableKey = (sections: TestTableSection[]): string =>
  JSON.stringify(
    sections.map((section) => ({
      id: section.id,
      rows: section.rows.map((row) => ({
        id: row.id,
        selectedNo: row.selectedNo,
        qaaChoiceIndex: row.qaaChoiceIndex,
        pageBreakBefore: row.pageBreakBefore,
      })),
    })),
  );

type ExamPreviewCommitKeyInput = {
  title: string;
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
  examDate?: ExamDateOption;
  sections: TestTableSection[];
  mapsVersion: number;
};

export const buildExamPreviewCommitKey = (
  input: ExamPreviewCommitKeyInput,
): string | null => {
  // 行が1件もない状態ではcommitをスキップする
  const hasAnyRow = input.sections.some((s) => s.rows.length > 0);
  if (!hasAnyRow) return null;
  return JSON.stringify({
    creationType: 'exam',
    title: input.title,
    isShuffleChoices: input.isShuffleChoices,
    shuffleSeed: input.shuffleSeed,
    examDate: input.examDate,
    sections: createPreviewTableKey(input.sections),
    mapsVersion: input.mapsVersion,
  });
};

type WorkbookPreviewCommitKeyInput = {
  title: string;
  workbookMode: WorkbookMode;
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
  sections: TestTableSection[];
  mapsVersion: number;
};

export const buildWorkbookPreviewCommitKey = (
  input: WorkbookPreviewCommitKeyInput,
): string | null => {
  // 行が0件の状態ではcommitをスキップする
  const hasAnyRow = input.sections.some((s) => s.rows.length > 0);
  if (!hasAnyRow) return null;
  return JSON.stringify({
    creationType: 'workbook',
    title: input.title,
    workbookMode: input.workbookMode,
    isShuffleChoices: input.isShuffleChoices,
    shuffleSeed: input.shuffleSeed,
    sections: createPreviewTableKey(input.sections),
    mapsVersion: input.mapsVersion,
  });
};

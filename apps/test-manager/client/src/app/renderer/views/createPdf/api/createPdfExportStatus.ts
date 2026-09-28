import {
  createCreatePdfStatusReason,
  dedupeStatusReasons,
} from '@views/createPdf/api/createPdfStatusReasons';
import { getBlockingTestTableReasons } from '@views/createPdf/api/createPdfTestTableChecks';
import type {
  CreatePdfDrawConditionChangeStatus,
  CreatePdfExportStatus,
  CreatePdfPreviewStatus,
  CreatePdfStatusReason,
  CreatePdfTestTableCheckSnapshot,
} from '@views/createPdf/types/statusState';

type DeriveCreatePdfExportStatusParams = {
  outputDirectory: string;
  hasUnsavedTableChanges: boolean;
  isExporting: boolean;
  previewStatus: CreatePdfPreviewStatus;
  testTableChecks: CreatePdfTestTableCheckSnapshot;
  drawConditionChangeStatus: CreatePdfDrawConditionChangeStatus;
};

export const deriveCreatePdfExportStatus = ({
  outputDirectory,
  isExporting,
  previewStatus,
  testTableChecks,
  drawConditionChangeStatus,
}: DeriveCreatePdfExportStatusParams): CreatePdfExportStatus => {
  const blockingReasons: CreatePdfStatusReason[] = [];
  const warningReasons: CreatePdfStatusReason[] = [];

  if (drawConditionChangeStatus.kind === 'not-drawn') {
    // 行なし = 未抽選。テーブル個別チェックは抑制する
    blockingReasons.push(
      createCreatePdfStatusReason({
        code: 'test-table-empty',
        severity: 'blocking',
        message: 'まだ抽選が実行されていません。抽選を行ってください。',
      }),
    );
  } else {
    // 行あり（clean or changed）: テーブルチェックを通常通り実行
    // blank-row は複数行あっても1件にまとめて表示する
    const tableReasons = getBlockingTestTableReasons(testTableChecks);
    if (testTableChecks.blankRows.length > 0) {
      blockingReasons.push(
        createCreatePdfStatusReason({
          code: 'blank-row',
          severity: 'blocking',
        }),
      );
    }
    blockingReasons.push(...tableReasons.filter((r) => r.code !== 'blank-row'));
  }

  if (!outputDirectory) {
    blockingReasons.push(
      createCreatePdfStatusReason({
        code: 'output-folder-missing',
        severity: 'blocking',
        message:
          '出力先フォルダが指定されていません。出力先を指定してください。',
      }),
    );
  }

  blockingReasons.push(
    ...previewStatus.reasons.filter(
      (reason) => reason.severity === 'blocking' || reason.severity === 'error',
    ),
  );

  if (isExporting) {
    blockingReasons.push(
      createCreatePdfStatusReason({ code: 'exporting', severity: 'blocking' }),
    );
  }

  warningReasons.push(
    ...previewStatus.reasons.filter((reason) => reason.severity === 'warning'),
  );
  // changed には JSON リストア後（lastAppliedKey=null & 行あり）も含まれる
  if (drawConditionChangeStatus.kind === 'changed') {
    warningReasons.push(
      createCreatePdfStatusReason({
        code: 'unapplied-draw-conditions',
        severity: 'warning',
        message: '現在の問題テーブルは最新の抽選条件を反映していません。',
      }),
    );
  }

  const uniqueBlockingReasons = dedupeStatusReasons(blockingReasons);
  const uniqueWarningReasons = dedupeStatusReasons(warningReasons);

  return {
    kind:
      uniqueBlockingReasons.length > 0
        ? 'blocked'
        : uniqueWarningReasons.length > 0
          ? 'warning'
          : 'ready',
    canExport: uniqueBlockingReasons.length === 0,
    blockingReasons: uniqueBlockingReasons,
    warningReasons: uniqueWarningReasons,
  };
};

import type { CreatePdfExportPreviewWindowStatus } from '@shared/types/createPdfExport';
import type {
  CreatePdfPreviewCacheMeta,
  CreationType,
} from '@shared/types/pdfPreview';
import {
  createCreatePdfStatusReason,
  dedupeStatusReasons,
} from '@views/createPdf/api/createPdfStatusReasons';
import type {
  CreatePdfPreviewStatus,
  CreatePdfStatusReason,
  CreatePdfStatusReasonCode,
} from '@views/createPdf/types/statusState';
import type { CreatePdfCurrentPreviewState } from '@views/createPdf/types/viewState';

type DeriveCreatePdfPreviewStatusParams = {
  creationType: CreationType;
  slotKey: string;
  currentPreviewState: CreatePdfCurrentPreviewState | null;
  lastMeta?: CreatePdfPreviewCacheMeta | null;
  previewWindowStatus?: CreatePdfExportPreviewWindowStatus;
  isCommitting?: boolean;
};

const BLOCKING_KIND_BY_REASON_CODE = {
  'preview-window-closed': 'closed',
  'preview-target-mismatch': 'target-mismatch',
  'preview-committing': 'committing',
  'preview-unexpected-error': 'error',
  'preview-rendering': 'rendering',
  // PreviewWindow 起動直後の準備待ちは、UI上は描画待ち系として扱う。
  'preview-not-ready': 'rendering',
  'preview-stale-revision': 'stale-revision',
  'preview-not-updated': 'not-updated',
} as const satisfies Partial<Record<string, CreatePdfPreviewStatus['kind']>>;

const BLOCKING_REASON_PRIORITY: ReadonlyMap<string, number> = new Map(
  Object.keys(BLOCKING_KIND_BY_REASON_CODE).map((code, index) => [code, index]),
);

const toBlockingPreviewKind = (code: CreatePdfStatusReasonCode | undefined) => {
  if (code === undefined) return 'rendering';
  if (code in BLOCKING_KIND_BY_REASON_CODE) {
    return BLOCKING_KIND_BY_REASON_CODE[
      code as keyof typeof BLOCKING_KIND_BY_REASON_CODE
    ];
  }
  return 'rendering';
};

export const deriveCreatePdfPreviewStatus = ({
  creationType,
  slotKey,
  currentPreviewState,
  lastMeta = null,
  previewWindowStatus,
  isCommitting = false,
}: DeriveCreatePdfPreviewStatusParams): CreatePdfPreviewStatus => {
  const reasons: CreatePdfStatusReason[] = [];
  const issues = currentPreviewState?.issues ?? [];

  if (isCommitting) {
    reasons.push(
      createCreatePdfStatusReason({
        code: 'preview-committing',
        severity: 'blocking',
      }),
    );
  }

  if (lastMeta === null) {
    reasons.push(
      createCreatePdfStatusReason({
        code: 'preview-not-updated',
        severity: 'blocking',
      }),
    );
  }

  if (previewWindowStatus !== undefined) {
    if (!previewWindowStatus.isOpen) {
      reasons.push(
        createCreatePdfStatusReason({
          code: 'preview-window-closed',
          severity: 'blocking',
        }),
      );
    } else if (
      previewWindowStatus.creationType !== creationType ||
      previewWindowStatus.slotKey !== slotKey
    ) {
      reasons.push(
        createCreatePdfStatusReason({
          code: 'preview-target-mismatch',
          severity: 'blocking',
        }),
      );
    } else {
      if (previewWindowStatus.isRendering) {
        reasons.push(
          createCreatePdfStatusReason({
            code: 'preview-rendering',
            severity: 'blocking',
          }),
        );
      }
      if (!previewWindowStatus.isReady) {
        reasons.push(
          createCreatePdfStatusReason({
            code: 'preview-not-ready',
            severity: 'blocking',
          }),
        );
      }
      if (
        lastMeta !== null &&
        previewWindowStatus.revision !== lastMeta.revision
      ) {
        reasons.push(
          createCreatePdfStatusReason({
            code: 'preview-stale-revision',
            severity: 'warning',
          }),
        );
      }
    }
  }

  const hasRenderingIssue = issues.some((issue) => issue.type === 'rendering');
  const hasUnexpectedIssue = issues.some(
    (issue) => issue.type === 'unexpected-error',
  );
  const hasWarningIssue = issues.some(
    (issue) => issue.type !== 'rendering' && issue.type !== 'unexpected-error',
  );

  if (hasRenderingIssue) {
    reasons.push(
      createCreatePdfStatusReason({
        code: 'preview-rendering',
        severity: 'blocking',
      }),
    );
  }
  if (hasUnexpectedIssue) {
    reasons.push(
      createCreatePdfStatusReason({
        code: 'preview-unexpected-error',
        severity: 'blocking',
      }),
    );
  }
  if (hasWarningIssue) {
    reasons.push(
      ...issues
        .filter(
          (issue) =>
            issue.type !== 'rendering' && issue.type !== 'unexpected-error',
        )
        .map((issue) =>
          createCreatePdfStatusReason({
            code: 'preview-has-issues',
            severity: 'warning',
            message: issue.message,
          }),
        ),
    );
  }

  const uniqueReasons = dedupeStatusReasons(reasons);
  const hasBlocking = uniqueReasons.some(
    (reason) => reason.severity === 'blocking',
  );
  if (hasBlocking) {
    const firstBlockingCode = uniqueReasons
      .filter((reason) => reason.severity === 'blocking')
      .sort(
        (left, right) =>
          (BLOCKING_REASON_PRIORITY.get(left.code) ?? Number.MAX_SAFE_INTEGER) -
          (BLOCKING_REASON_PRIORITY.get(right.code) ?? Number.MAX_SAFE_INTEGER),
      )[0]?.code;
    return {
      kind: toBlockingPreviewKind(firstBlockingCode),
      canUseForExport: false,
      reasons: uniqueReasons,
      issues,
    };
  }

  return {
    kind: uniqueReasons.length > 0 ? 'has-issues' : 'ready',
    canUseForExport: true,
    reasons: uniqueReasons,
    issues,
  };
};

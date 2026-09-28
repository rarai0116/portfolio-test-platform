import type { CreatePdfPreviewIssue, CreationType } from './viewState';

export type CreatePdfStatusSeverity = 'info' | 'warning' | 'error' | 'blocking';

export type CreatePdfStatusReasonCode =
  | 'output-folder-missing'
  | 'test-table-empty'
  | 'blank-row'
  | 'qaa-choice-missing'
  | 'invalid-no'
  | 'invalid-choice'
  | 'duplicate-question'
  | 'orphan-fixed-row'
  | 'preview-window-closed'
  | 'preview-not-updated'
  | 'preview-committing'
  | 'preview-rendering'
  | 'preview-not-ready'
  | 'preview-target-mismatch'
  | 'preview-stale-revision'
  | 'preview-has-issues'
  | 'preview-unexpected-error'
  | 'exporting'
  | 'unapplied-draw-conditions'
  | 'draw-category-missing'
  | 'draw-bfs-calculating'
  | 'draw-candidate-empty'
  | 'draw-fixed-count-exceeded'
  | 'draw-engine-error'
  | 'draw-validation-error'
  | 'subject-out-of-range';

export type CreatePdfStatusReason = {
  code: CreatePdfStatusReasonCode;
  severity: CreatePdfStatusSeverity;
  message: string;
  target?: {
    sectionId?: string;
    rowId?: string;
    conditionId?: string;
    slotId?: string;
  };
};

export type CreatePdfExportStatus = {
  kind: 'ready' | 'blocked' | 'warning';
  canExport: boolean;
  blockingReasons: CreatePdfStatusReason[];
  warningReasons: CreatePdfStatusReason[];
};

export type CreatePdfPreviewStatusKind =
  | 'ready'
  | 'closed'
  | 'not-updated'
  | 'committing'
  | 'rendering'
  | 'target-mismatch'
  | 'stale-revision'
  | 'has-issues'
  | 'error';

export type CreatePdfPreviewStatus = {
  kind: CreatePdfPreviewStatusKind;
  canUseForExport: boolean;
  reasons: CreatePdfStatusReason[];
  issues: CreatePdfPreviewIssue[];
};

export type CreatePdfDrawStatus = {
  kind: 'ready' | 'blocked';
  canDraw: boolean;
  blockingReasons: CreatePdfStatusReason[];
};

export type CreatePdfDrawConditionChangeStatus = {
  kind: 'clean' | 'changed' | 'not-drawn';
  hasUnappliedDrawConditions: boolean;
  currentDrawConditionKey: string | null;
  lastAppliedDrawConditionKey: string | null;
};

export type CreatePdfStatusMeta = {
  computedAt: number;
  creationType: CreationType;
  slotKey: string;
  sourceRevision: string;
};

export type CreatePdfUserStatusSnapshot = {
  exportStatus: CreatePdfExportStatus;
  previewStatus: CreatePdfPreviewStatus;
  drawStatus: CreatePdfDrawStatus;
  drawConditionChangeStatus: CreatePdfDrawConditionChangeStatus;
  meta: CreatePdfStatusMeta;
};

export type CreatePdfTestTableCheckSnapshot = {
  blankRows: CreatePdfStatusReason[];
  invalidNoRows: CreatePdfStatusReason[];
  invalidChoiceRows: CreatePdfStatusReason[];
  qaaChoiceMissingRows: CreatePdfStatusReason[];
  duplicateRows: CreatePdfStatusReason[];
  orphanFixedRows: CreatePdfStatusReason[];
  subjectMismatchRows: CreatePdfStatusReason[];
};

export type CreatePdfTestTableRowMarkerCode =
  | 'blank-row'
  | 'invalid-no'
  | 'invalid-choice'
  | 'duplicate-question'
  | 'orphan-fixed-row'
  | 'fixed-year-out-of-condition'
  | 'fixed-category-out-of-condition'
  | 'fixed-excluded-tag'
  | 'fixed-qaa-condition-mismatch'
  | 'subject-out-of-range';

export type CreatePdfTestTableTargetCell =
  | 'no'
  | 'choice'
  | 'category'
  | 'fixed'
  | 'row';

export type CreatePdfTestTableRowMarker = {
  code: CreatePdfTestTableRowMarkerCode;
  severity: CreatePdfStatusSeverity;
  message: string;
  targetCell?: CreatePdfTestTableTargetCell;
};

export type CreatePdfTestTableRowStatus = {
  sectionId: string;
  rowId: string;
  severity: CreatePdfStatusSeverity;
  markers: CreatePdfTestTableRowMarker[];
};

import { createCreatePdfStatusReason } from '@views/createPdf/api/createPdfStatusReasons';
import { describe, expect, it } from 'vitest';
import { deriveCreatePdfExportStatus } from './createPdfExportStatus';

const emptyChecks = {
  blankRows: [],
  invalidNoRows: [],
  invalidChoiceRows: [],
  qaaChoiceMissingRows: [],
  duplicateRows: [],
  orphanFixedRows: [],
  subjectMismatchRows: [],
};

describe('deriveCreatePdfExportStatus', () => {
  it('conditionId や slotId が異なる reason をまとめない', () => {
    const status = deriveCreatePdfExportStatus({
      outputDirectory: '/tmp',
      hasUnsavedTableChanges: false,
      isExporting: false,
      previewStatus: {
        kind: 'has-issues',
        canUseForExport: false,
        reasons: [
          createCreatePdfStatusReason({
            code: 'preview-has-issues',
            severity: 'warning',
            message: '同じ文言',
            target: { conditionId: 'condition-a' },
          }),
          createCreatePdfStatusReason({
            code: 'preview-has-issues',
            severity: 'warning',
            message: '同じ文言',
            target: { conditionId: 'condition-b' },
          }),
          createCreatePdfStatusReason({
            code: 'preview-has-issues',
            severity: 'warning',
            message: '同じ文言',
            target: { slotId: 'slot-a' },
          }),
        ],
        issues: [],
      },
      testTableChecks: emptyChecks,
      drawConditionChangeStatus: {
        kind: 'clean',
        hasUnappliedDrawConditions: false,
        currentDrawConditionKey: 'current',
        lastAppliedDrawConditionKey: 'current',
      },
    });

    expect(status.warningReasons).toHaveLength(3);
  });
});

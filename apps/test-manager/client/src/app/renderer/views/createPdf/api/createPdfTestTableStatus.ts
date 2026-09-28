import type {
  CreatePdfStatusReason,
  CreatePdfStatusSeverity,
  CreatePdfTestTableCheckSnapshot,
  CreatePdfTestTableRowMarker,
  CreatePdfTestTableRowStatus,
} from '@views/createPdf/types/statusState';
import type { TestTableSection } from '@views/createPdf/types/testTable';

const SEVERITY_ORDER: Record<CreatePdfStatusSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3,
};

const maxSeverity = (
  markers: readonly CreatePdfTestTableRowMarker[],
): CreatePdfStatusSeverity =>
  markers.reduce<CreatePdfStatusSeverity>(
    (current, marker) =>
      SEVERITY_ORDER[marker.severity] > SEVERITY_ORDER[current]
        ? marker.severity
        : current,
    'info',
  );

const targetCellByReasonCode: Partial<
  Record<
    CreatePdfStatusReason['code'],
    CreatePdfTestTableRowMarker['targetCell']
  >
> = {
  'blank-row': 'no',
  'qaa-choice-missing': 'choice',
  'invalid-no': 'no',
  'invalid-choice': 'choice',
  'duplicate-question': 'row',
  'orphan-fixed-row': 'fixed',
  'subject-out-of-range': 'no',
};

const markerCodeByReasonCode: Partial<
  Record<CreatePdfStatusReason['code'], CreatePdfTestTableRowMarker['code']>
> = {
  'blank-row': 'blank-row',
  'qaa-choice-missing': 'blank-row',
  'invalid-no': 'invalid-no',
  'invalid-choice': 'invalid-choice',
  'duplicate-question': 'duplicate-question',
  'orphan-fixed-row': 'orphan-fixed-row',
  'subject-out-of-range': 'subject-out-of-range',
};

const addReasonMarkers = (
  markerByRowKey: Map<string, CreatePdfTestTableRowMarker[]>,
  reasons: readonly CreatePdfStatusReason[],
): void => {
  for (const reason of reasons) {
    const { sectionId, rowId } = reason.target ?? {};
    const markerCode = markerCodeByReasonCode[reason.code];
    if (!sectionId || !rowId || markerCode === undefined) continue;
    const rowKey = `${sectionId}:${rowId}`;
    const markers = markerByRowKey.get(rowKey) ?? [];
    markers.push({
      code: markerCode,
      severity: reason.severity,
      targetCell: targetCellByReasonCode[reason.code],
      message: reason.message,
    });
    markerByRowKey.set(rowKey, markers);
  }
};

export const deriveCreatePdfTestTableRowStatuses = (params: {
  sections: readonly TestTableSection[];
  checks: CreatePdfTestTableCheckSnapshot;
  warningMarkersByRowKey?: ReadonlyMap<
    string,
    readonly CreatePdfTestTableRowMarker[]
  >;
}): CreatePdfTestTableRowStatus[] => {
  const markerByRowKey = new Map<string, CreatePdfTestTableRowMarker[]>();
  const allCheckReasons = [
    ...params.checks.blankRows,
    ...params.checks.invalidNoRows,
    ...params.checks.invalidChoiceRows,
    ...params.checks.qaaChoiceMissingRows,
    ...params.checks.duplicateRows,
    ...params.checks.orphanFixedRows,
    ...params.checks.subjectMismatchRows,
  ];
  addReasonMarkers(markerByRowKey, allCheckReasons);

  for (const [rowKey, markers] of params.warningMarkersByRowKey ?? []) {
    const current = markerByRowKey.get(rowKey) ?? [];
    markerByRowKey.set(rowKey, [...current, ...markers]);
  }

  return params.sections.flatMap((section) =>
    section.rows.flatMap((row) => {
      const rowKey = `${section.id}:${row.id}`;
      const markers = markerByRowKey.get(rowKey) ?? [];
      if (markers.length === 0) return [];
      return [
        {
          sectionId: section.id,
          rowId: row.id,
          severity: maxSeverity(markers),
          markers,
        },
      ];
    }),
  );
};

import type { TestData } from '@shared/types/contracts';
import {
  hasChoiceHtml,
  normalizeQaaChoiceIndex,
  toCandidateKey,
} from '@views/createPdf/api/candidateIndex';
import { createCreatePdfStatusReason } from '@views/createPdf/api/createPdfStatusReasons';
import type {
  CreatePdfStatusReason,
  CreatePdfStatusReasonCode,
  CreatePdfTestTableCheckSnapshot,
} from '@views/createPdf/types/statusState';
import type {
  TestTableSection,
  TestTableSectionMode,
  TestTableSectionSubject,
} from '@views/createPdf/types/testTable';

type RowContext = {
  sectionId: string;
  rowId: string;
  rowNumber: number;
  selectedNo: string | null;
  qaaChoiceIndex: number | null;
  isFixed: boolean;
  sourceConditionId: string | null;
  /** 問題テーブル単位の対象学科。'all' は将来の混在テーブル用。 */
  assignedSubject: TestTableSectionSubject | null;
};

type DeriveCreatePdfTestTableChecksParams = {
  sections: readonly TestTableSection[];
  testDataByNo: ReadonlyMap<number, TestData>;
  showQaaChoiceIndex: boolean;
  grade?: 1 | 2;
  sectionMode: TestTableSectionMode;
  activeConditionIds?: ReadonlySet<string>;
};

const flattenRows = (sections: readonly TestTableSection[]): RowContext[] =>
  sections.flatMap((section) =>
    section.rows.map((row, index) => ({
      sectionId: section.id,
      rowId: row.id,
      rowNumber: index + 1,
      selectedNo: row.selectedNo,
      qaaChoiceIndex: row.qaaChoiceIndex,
      isFixed: row.isFixed,
      sourceConditionId: row.sourceConditionId,
      assignedSubject: section.subject ?? null,
    })),
  );

const createRowReason = (
  code: CreatePdfStatusReason['code'],
  message: string,
  row: RowContext,
): CreatePdfStatusReason =>
  createCreatePdfStatusReason({
    code,
    severity: 'blocking',
    message,
    target: { sectionId: row.sectionId, rowId: row.rowId },
  });

export const deriveCreatePdfTestTableChecks = ({
  sections,
  testDataByNo,
  showQaaChoiceIndex,
  grade,
}: DeriveCreatePdfTestTableChecksParams): CreatePdfTestTableCheckSnapshot => {
  const rows = flattenRows(sections);
  const blankRows: CreatePdfStatusReason[] = [];
  const invalidNoRows: CreatePdfStatusReason[] = [];
  const invalidChoiceRows: CreatePdfStatusReason[] = [];
  const qaaChoiceMissingRows: CreatePdfStatusReason[] = [];
  const duplicateRows: CreatePdfStatusReason[] = [];
  const orphanFixedRows: CreatePdfStatusReason[] = [];
  const subjectMismatchRows: CreatePdfStatusReason[] = [];
  const seenRowByCandidateKey = new Map<string, RowContext>();

  for (const row of rows) {
    if (row.selectedNo === null) {
      blankRows.push(
        createRowReason('blank-row', '問題番号が未入力の行があります。', row),
      );
      continue;
    }

    const selectedNo = Number(row.selectedNo);
    const testData = Number.isFinite(selectedNo)
      ? testDataByNo.get(selectedNo)
      : undefined;

    if (testData === undefined) {
      invalidNoRows.push(
        createRowReason(
          'invalid-no',
          `存在しない問題Noを指定しています(${row.selectedNo})`,
          row,
        ),
      );
      continue;
    }

    if (
      row.assignedSubject !== null &&
      row.assignedSubject !== 'all' &&
      testData.subject !== row.assignedSubject
    ) {
      subjectMismatchRows.push(
        createRowReason(
          'subject-out-of-range',
          `No.${row.selectedNo} は指定された学科(${row.assignedSubject})の対象外です。`,
          row,
        ),
      );
    }

    const qaaChoiceIndex = normalizeQaaChoiceIndex(row.qaaChoiceIndex);
    const isQaaChoiceOutOfGradeRange =
      qaaChoiceIndex !== null &&
      ((grade === 1 && qaaChoiceIndex > 4) || qaaChoiceIndex > 5);
    const isQaaChoiceMissingHtml =
      qaaChoiceIndex !== null && !hasChoiceHtml(testData, qaaChoiceIndex);

    if (showQaaChoiceIndex && qaaChoiceIndex === null) {
      qaaChoiceMissingRows.push(
        createRowReason(
          'qaa-choice-missing',
          `No.${row.selectedNo} の選択肢Noが未確定です。`,
          row,
        ),
      );
    }

    if (
      showQaaChoiceIndex &&
      qaaChoiceIndex !== null &&
      (isQaaChoiceOutOfGradeRange || isQaaChoiceMissingHtml)
    ) {
      invalidChoiceRows.push(
        createRowReason(
          'invalid-choice',
          `No.${row.selectedNo} に指定できない選択肢Noが含まれています。`,
          row,
        ),
      );
    }

    const duplicateKey = showQaaChoiceIndex
      ? qaaChoiceIndex === null
        ? null
        : toCandidateKey(selectedNo, qaaChoiceIndex)
      : toCandidateKey(selectedNo, null);
    if (duplicateKey !== null) {
      const firstRow = seenRowByCandidateKey.get(duplicateKey);
      if (firstRow !== undefined) {
        const message = showQaaChoiceIndex
          ? `${firstRow.rowNumber}行目と${row.rowNumber}行目の選択肢No.${qaaChoiceIndex} が重複しています。`
          : `${firstRow.rowNumber}行目と${row.rowNumber}行目が重複しています。`;
        duplicateRows.push(
          createRowReason('duplicate-question', message, firstRow),
        );
        duplicateRows.push(createRowReason('duplicate-question', message, row));
      } else {
        seenRowByCandidateKey.set(duplicateKey, row);
      }
    }
  }

  return {
    blankRows,
    invalidNoRows,
    invalidChoiceRows,
    qaaChoiceMissingRows,
    duplicateRows,
    orphanFixedRows,
    subjectMismatchRows,
  };
};

export const getBlockingTestTableReasons = (
  snapshot: CreatePdfTestTableCheckSnapshot,
): CreatePdfStatusReason[] => [
  ...snapshot.blankRows,
  ...snapshot.invalidNoRows,
  ...snapshot.invalidChoiceRows,
  ...snapshot.qaaChoiceMissingRows,
  ...snapshot.duplicateRows,
  ...snapshot.subjectMismatchRows,
];

const DRAW_BLOCKING_TEST_TABLE_REASON_CODES =
  new Set<CreatePdfStatusReasonCode>(['invalid-no', 'invalid-choice']);

export const getDrawBlockingTestTableReasons = (
  snapshot: CreatePdfTestTableCheckSnapshot,
): CreatePdfStatusReason[] =>
  getBlockingTestTableReasons(snapshot).filter((reason) =>
    DRAW_BLOCKING_TEST_TABLE_REASON_CODES.has(reason.code),
  );

import type {
  TestCategoryCondition,
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';
import { createCreatePdfId } from './common';

export const createEmptyTestCategoryCondition = (): TestCategoryCondition => ({
  id: createCreatePdfId('test-category-condition'),
  subject: null,
  bigCategoryTag: null,
  smallCategoryTag: null,
});

export const createEmptyTestTableRow = (
  categoryTable: TestCategoryCondition[] = [createEmptyTestCategoryCondition()],
): TestTableRow => ({
  id: createCreatePdfId('test-table-row'),
  sourceConditionId: null,
  categoryTable,
  selectedNo: null,
  qaaChoiceIndex: null,
  isFixed: false,
  pageBreakBefore: false,
  hasError: false,
  errorMessage: null,
});

export const createEmptyTestTableSection = (
  label: string,
): TestTableSection => ({
  id: createCreatePdfId('test-table-section'),
  label,
  rows: [],
});

export const replaceTestTableRow = (
  rows: TestTableRow[],
  rowId: string,
  updater: (row: TestTableRow) => TestTableRow,
): TestTableRow[] => rows.map((row) => (row.id === rowId ? updater(row) : row));

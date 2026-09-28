import type { WorkbookCategoryTableRow } from '@views/createPdf/types/viewState';
import { createCreatePdfId } from './common';

const WORKBOOK_CATEGORY_CONDITION_ID_PREFIX = 'workbook-category-condition:v1:';

export const createWorkbookCategoryConditionId = (input: {
  subject: string;
  bigCategoryTag: string;
  smallCategoryTag: string | null;
}): string =>
  `${WORKBOOK_CATEGORY_CONDITION_ID_PREFIX}${encodeURIComponent(
    JSON.stringify([
      input.subject,
      input.bigCategoryTag,
      input.smallCategoryTag,
    ]),
  )}`;

export const createWorkbookCategoryTableRow = (
  initial: Pick<
    WorkbookCategoryTableRow,
    'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
  >,
): WorkbookCategoryTableRow => ({
  id: createCreatePdfId('workbook-category-condition'),
  subject: initial.subject,
  bigCategoryTag: initial.bigCategoryTag,
  smallCategoryTag: initial.smallCategoryTag,
  count: initial.count,
});

export const createStableWorkbookCategoryTableRow = (
  initial: Pick<
    WorkbookCategoryTableRow,
    'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
  > & {
    subject: string;
    bigCategoryTag: string;
  },
): WorkbookCategoryTableRow => ({
  id: createWorkbookCategoryConditionId(initial),
  subject: initial.subject,
  bigCategoryTag: initial.bigCategoryTag,
  smallCategoryTag: initial.smallCategoryTag,
  count: initial.count,
});

export const replaceWorkbookCategoryTableRow = (
  conditions: WorkbookCategoryTableRow[],
  conditionId: string,
  updater: (condition: WorkbookCategoryTableRow) => WorkbookCategoryTableRow,
): WorkbookCategoryTableRow[] =>
  conditions.map((condition) =>
    condition.id === conditionId ? updater(condition) : condition,
  );

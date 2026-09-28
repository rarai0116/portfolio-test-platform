import type { ExamCategoryTableRow } from '@views/createPdf/types/draftState';
import type { TestTableSection } from '@views/createPdf/types/testTable';

export const reconnectExamTableRowsToCategoryRows = (params: {
  categoryRows: readonly ExamCategoryTableRow[];
  sections: readonly TestTableSection[];
}): TestTableSection[] => {
  const { categoryRows, sections } = params;
  const validConditionIds = new Set(categoryRows.map((row) => row.id));
  const categoryRowsBySubject = new Map<string, ExamCategoryTableRow[]>();

  for (const row of categoryRows) {
    const rows = categoryRowsBySubject.get(row.subject) ?? [];
    rows.push(row);
    categoryRowsBySubject.set(row.subject, rows);
  }

  let hasChanged = false;
  const nextSections = sections.map((section) => {
    const subjectCategoryRows = categoryRowsBySubject.get(section.label);
    if (subjectCategoryRows === undefined) return section;

    let sectionChanged = false;
    const rows = section.rows.map((row, index) => {
      if (
        row.sourceConditionId !== null &&
        validConditionIds.has(row.sourceConditionId)
      ) {
        return row;
      }

      const categoryRow = subjectCategoryRows[index];
      if (categoryRow === undefined) return row;

      sectionChanged = true;
      hasChanged = true;
      return { ...row, sourceConditionId: categoryRow.id };
    });

    return sectionChanged ? { ...section, rows } : section;
  });

  return hasChanged ? nextSections : [...sections];
};

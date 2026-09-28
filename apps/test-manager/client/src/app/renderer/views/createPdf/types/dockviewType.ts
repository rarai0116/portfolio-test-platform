export const createPdfPanel = {
  exam: 'create-pdf-panel-exam',
  workbook: 'create-pdf-panel-workbook',
  // preview は外部ウィンドウに一本化したため廃止
  testTable: 'create-pdf-panel-test-table',
  tempExam: 'create-pdf-panel-temp-exam',
  tempWorkbook: 'create-pdf-panel-temp-workbook',
} as const;

export type CreatePdfPanelId =
  (typeof createPdfPanel)[keyof typeof createPdfPanel];

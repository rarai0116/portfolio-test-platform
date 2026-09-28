import { describe, expect, it } from 'vitest';
import { buildSlotKey } from './pdfPreview';

describe('buildSlotKey', () => {
  it('exam モード: grade のみを使う', () => {
    expect(buildSlotKey({ grade: 1, workbookMode: null })).toBe('grade:1');
    expect(buildSlotKey({ grade: 2, workbookMode: null })).toBe('grade:2');
  });

  it('workbook モード: grade と workbookMode を組み合わせる', () => {
    expect(buildSlotKey({ grade: 1, workbookMode: 'qaa' })).toBe(
      'grade:1:workbookMode:qaa',
    );
    expect(buildSlotKey({ grade: 2, workbookMode: 'multipleChoice' })).toBe(
      'grade:2:workbookMode:multipleChoice',
    );
  });
});

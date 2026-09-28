import {
  createInitialCreatePdfRouteSnapshot,
  resolveCreatePdfInitialLoad,
  resolveCreatePdfModeFromPathname,
} from '@views/createPdf/api/routeModeState';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@api/shuffleSeed', () => ({
  generateShuffleSeed: () => 12345,
}));

describe('routeModeState', () => {
  it('pathname から作成モードを解決できる', () => {
    expect(resolveCreatePdfModeFromPathname('/createPdf/exam')).toBe('exam');
    expect(resolveCreatePdfModeFromPathname('/createPdf/main')).toBe(
      'tempExam',
    );
    expect(resolveCreatePdfModeFromPathname('/createPdf/tempWorkbook')).toBe(
      'tempWorkbook',
    );
    expect(resolveCreatePdfModeFromPathname('/createPdf/workbook')).toBe(
      'workbook',
    );
    expect(resolveCreatePdfModeFromPathname('/createPdf')).toBe('exam');
  });

  it('tempWorkbook の初期状態は workbook draft を使う', () => {
    const snapshot = createInitialCreatePdfRouteSnapshot('tempWorkbook');

    expect(snapshot.common.creationType).toBe('workbook');
    expect(snapshot.workbook).toBeDefined();
    expect(snapshot.exam).toBeUndefined();
  });

  it('初回読み込みでは JSON 復元を最優先する', () => {
    const jsonSnapshot = createInitialCreatePdfRouteSnapshot('workbook');
    const savedSnapshot = createInitialCreatePdfRouteSnapshot('exam');

    const result = resolveCreatePdfInitialLoad({
      mode: 'workbook',
      jsonSnapshot,
      savedSnapshot,
    });

    expect(result.source).toBe('json');
    expect(result.snapshot).toEqual(jsonSnapshot);
  });

  it('保存済み状態が無ければ初期状態へフォールバックする', () => {
    const result = resolveCreatePdfInitialLoad({ mode: 'workbook' });

    expect(result.source).toBe('initialState');
    expect(result.snapshot).toEqual(
      createInitialCreatePdfRouteSnapshot('workbook'),
    );
  });
});

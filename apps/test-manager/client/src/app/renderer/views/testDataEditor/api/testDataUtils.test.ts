import { sanitizePersistedHtml } from '@api/htmlSanitizer';
import { describe, expect, it, vi } from 'vitest';
import {
  applyCommonRulesToHtml,
  applyEditorRuntimeRulesToHtml,
  deriveTestDataStatus,
  deriveTestDataStatusAfterResume,
} from './testDataUtils';

describe('testDataUtils status derivation', () => {
  it('通常時はautoCheckがfalseならエラーを返す', () => {
    expect(
      deriveTestDataStatus({
        currentStatus: '準備中',
        autoCheckOk: false,
        calibrationCheck: true,
      }),
    ).toBe('エラー');
  });

  it('通常時は停止中を最優先する', () => {
    expect(
      deriveTestDataStatus({
        currentStatus: '停止中',
        autoCheckOk: true,
        calibrationCheck: true,
      }),
    ).toBe('停止中');
  });

  it('停止解除時はautoCheckがfalseならエラーに戻す', () => {
    expect(
      deriveTestDataStatusAfterResume({
        autoCheckOk: false,
        calibrationCheck: false,
      }),
    ).toBe('エラー');
  });

  it('停止解除時はautoCheckがtrueでcalibrationCheckがfalseなら準備中に戻す', () => {
    expect(
      deriveTestDataStatusAfterResume({
        autoCheckOk: true,
        calibrationCheck: false,
      }),
    ).toBe('準備中');
  });

  it('保存正規化で img の src と危険な style を除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img src="data:image/png;base64,aaa" alt="sample" style="width: 100px; background-image: url(javascript:alert(1))" /></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-1',
      fieldName: 'text',
    });

    expect(consoleError).toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('testId=item-1'),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('field=text'),
    );
    expect(result).toContain('alt="sample"');
    expect(result).toContain('style="width: 100px"');
    expect(result).not.toContain('src=');
    expect(result).not.toContain('background-image');
  });

  it('保存正規化で width と height の空文字を保持する', () => {
    const html = '<p><img alt="sample" width="" height="" /></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-1',
      fieldName: 'text',
    });

    expect(result).toContain('width=""');
    expect(result).toContain('height=""');
  });

  it('保存正規化で img の max-width と max-height を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img alt="sample" style="max-width: 100%; max-height: 80%" /></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-1',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result).toContain('style="max-width: 100%; max-height: 80%"');
  });

  it('保存正規化で src 除去のみなら通知レベルで記録する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="data:image/png;base64,aaa" alt="sample" /></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-99',
      fieldName: 'answerText',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[html-sanitizer][通知]'),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('testId=item-99'),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('field=answerText'),
    );
    expect(result).toContain('<img alt="sample" />');
  });

  it('編集中の正規化では data URL の img src を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const html =
      '<p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="sample" /></p>';

    const result = applyEditorRuntimeRulesToHtml(html, {
      itemId: 'item-runtime',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();
    expect(result).toContain(
      'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="',
    );
    expect(result).toContain('alt="sample"');
  });

  it('旧エディタ由来の class や style ノイズは通知レベルで除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><span class="ql-cursor" style="float: none; display: inline; color: rgb(0, 0, 0); background-color: transparent;">text</span><img class="active" width="null" alt="sample" style="zoom: 0.2; white-space: pre-wrap; color: rgb(0, 0, 0); background-color: transparent; max-width: 100%;" /></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-legacy',
      fieldName: 'answerText',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalled();
    expect(result).not.toContain('ql-cursor');
    expect(result).not.toContain('class="active"');
    expect(result).not.toContain('width="null"');
    expect(result).not.toContain('zoom: 0.2');
    expect(result).not.toContain('white-space: pre-wrap');
    expect(result).not.toContain('color: rgb(0, 0, 0)');
    expect(result).not.toContain('background-color: transparent');
    expect(result).toContain('style="max-width: 100%"');
  });

  it('保存正規化で strong に付いた画像 style を img 側へ戻す', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const html =
      '<p><strong style="float: right; margin: 0px 0px 1em 1em; display: inline;"><img alt="sample" width="" /></strong></p>';

    const result = applyCommonRulesToHtml(html, {
      boundary: 'save',
      itemId: 'item-1',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(result).toContain('<strong><img');
    expect(result).toContain(
      'style="float: right; margin: 0px 0px 1em 1em; display: inline"',
    );
    expect(result).not.toContain('<strong style=');
  });

  it('保存正規化で img と br の self-closing を保持する', () => {
    const html = '<p><img alt="sample" /><br /></p>';

    const result = sanitizePersistedHtml(html, {
      boundary: 'save',
      itemId: 'item-void',
      fieldName: 'text',
    });

    expect(result.sanitizedHtml).toBe(html);
    expect(result.rejectionReport).toHaveLength(0);
    expect(result.normalizationSummary.wrapperStyleNormalizedCount).toBe(0);
  });

  it('保存正規化で wrapper style 正規化件数を返す', () => {
    const html =
      '<p><strong style="float: right; margin: 0px 0px 1em 1em; display: inline;"><img alt="sample" /></strong></p>';

    const result = sanitizePersistedHtml(html, {
      boundary: 'save',
      itemId: 'item-wrapper',
      fieldName: 'text',
    });

    expect(result.normalizationSummary.wrapperStyleNormalizedCount).toBe(1);
    expect(result.sanitizedHtml).toContain('<img alt="sample"');
    expect(result.sanitizedHtml).toContain(
      'style="float: right; margin: 0px 0px 1em 1em; display: inline"',
    );
  });
});

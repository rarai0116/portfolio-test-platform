import { describe, expect, it } from 'vitest';
import { ensureDisplayModeStyle } from './ensurePdf';

describe('ensureDisplayModeStyle', () => {
  it('patch mode では PreviewWindow の操作 UI を隠す style を注入する', () => {
    ensureDisplayModeStyle(document, 'patch');

    const style = document.head.querySelector<HTMLStyleElement>(
      'style[data-preview-mode-style="1"]',
    );

    expect(style?.textContent).toContain(
      '[data-create-pdf-preview-toolbar] { display: none !important; }',
    );
    expect(style?.textContent).toContain(
      '[data-create-pdf-preview-host] { padding-top: 0 !important; }',
    );
  });

  it('print mode では patch mode の UI 非表示 style を除去する', () => {
    ensureDisplayModeStyle(document, 'patch');
    ensureDisplayModeStyle(document, 'print');

    expect(
      document.head.querySelector('style[data-preview-mode-style="1"]'),
    ).toBeNull();
  });
});

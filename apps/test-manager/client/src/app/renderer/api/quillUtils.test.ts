import { afterEach, describe, expect, test, vi } from 'vitest';
import { EDITOR_DUMMY_IMG } from './dummyImage';
import {
  compactFormulaHtmlForStorage,
  exportHtmlForPreview,
  inflateFormulaHtmlForRender,
  prepareHtmlForQuillPaste,
  restoreHtmlFromQuill,
} from './quillUtils';

describe('quillUtils の数式HTML変換', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('最小構成の数式HTMLを Quill 表示用へ再展開できる', () => {
    const html =
      '<p>abc<span class="ql-formula" data-value="x^2"></span>def</p>';

    const result = prepareHtmlForQuillPaste(html);

    expect(result).toContain('class="ql-formula"');
    expect(result).toContain('data-value="x^2"');
    expect(result).toContain('class="katex"');
  });

  test('描画済み数式HTMLを保存用の最小構成へ縮約できる', () => {
    const html =
      '<p><span class="ql-formula" data-value="x^2"><span class="katex">rendered</span></span></p>';

    const result = compactFormulaHtmlForStorage(html);

    expect(result).toBe(
      '<p><span class="ql-formula" data-value="x^2"></span></p>',
    );
  });

  test('preview 出力は最小構成から数式を再描画する', () => {
    const html =
      '<p><span class="ql-formula" data-value="\\frac{1}{2}"></span></p>';

    const result = exportHtmlForPreview(html);

    expect(result).toContain('class="ql-formula"');
    expect(result).toContain('data-value="\\frac{1}{2}"');
    expect(result).toContain('class="katex"');
  });

  test('inflate は legacy の最小構成HTMLを直接再展開できる', () => {
    const html = '<span class="ql-formula" data-value="a+b"></span>';

    const result = inflateFormulaHtmlForRender(html);

    expect(result).toContain('class="ql-formula"');
    expect(result).toContain('data-value="a+b"');
    expect(result).toContain('class="katex"');
  });

  test('Quill取込時に危険な属性と任意のdata image srcを除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p onclick="alert(1)">safe<script>alert(1)</script><img src="data:image/png;base64,aaa" alt="img" onerror="alert(1)" /></p>';

    const result = prepareHtmlForQuillPaste(html);

    expect(consoleError).toHaveBeenCalled();
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onclick=');
    expect(result).not.toContain('onerror=');
    expect(result).not.toContain('src="data:image/png;base64,aaa"');
    expect(result).toContain('<img alt="img">');
    expect(consoleWarn).toHaveBeenCalled();
  });

  test('Quill取込時に正規のdemo-assetとエディタ用ダミーを保持する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const assetUrl =
      'demo-asset://images/firstGrade/key1.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA';
    const html = `<p><img src="${assetUrl}" alt="asset" /><img src="${EDITOR_DUMMY_IMG}" alt="pending" /></p>`;

    const result = prepareHtmlForQuillPaste(html);

    expect(result).toContain(assetUrl.replace('&', '&amp;'));
    expect(result).toContain(EDITOR_DUMMY_IMG);
  });

  test('Quill 取込時は非許可の img src を除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="https://example.com/a.png" alt="img" /></p>';

    const result = prepareHtmlForQuillPaste(html);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[html-sanitizer][通知]'),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('field=unknown'),
    );
    expect(result).not.toContain('https://example.com/a.png');
    expect(result).toContain('<img alt="img">');
  });

  test('Quill 復元時は編集中の data image src を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="img" /></p>';

    const result = restoreHtmlFromQuill(html);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result).toContain(
      'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="',
    );
    expect(result).toContain('alt="img"');
  });

  test('Quill 復元時は画像リサイズ用の一時属性をログなしで除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img alt="img" class="active" data-size="3390,2285" data-editor-natural-aspect="1" width="339" height="228" /></p>';

    const result = restoreHtmlFromQuill(html);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result).toContain('width="339"');
    expect(result).toContain('height="228"');
    expect(result).not.toContain('class="active"');
    expect(result).not.toContain('data-size=');
    expect(result).not.toContain('data-editor-natural-aspect=');
  });
  test('preview 出力時は data image src を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="img" /></p>';

    const result = exportHtmlForPreview(html);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result).toContain(
      'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="',
    );
    expect(result).toContain('alt="img"');
  });

  test('preview 出力時は画像リサイズ用の一時属性をログなしで除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p><img alt="img" class="active" data-size="3390,2285" data-editor-natural-aspect="1" width="339" height="228" /></p>';

    const result = exportHtmlForPreview(html);

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result).toContain('width="339"');
    expect(result).toContain('height="228"');
    expect(result).not.toContain('class="active"');
    expect(result).not.toContain('data-size=');
    expect(result).not.toContain('data-editor-natural-aspect=');
  });
});

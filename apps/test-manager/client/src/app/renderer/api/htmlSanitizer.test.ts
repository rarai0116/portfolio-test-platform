import { afterEach, describe, expect, test, vi } from 'vitest';
import { DUMMY_IMG, EDITOR_DUMMY_IMG } from './dummyImage';
import {
  sanitizeEditorRuntimeHtml,
  sanitizeForPreviewRender,
  sanitizeForQuillImport,
  sanitizePersistedHtml,
} from './htmlSanitizer';

describe('htmlSanitizer の img src 制御', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('編集中は data image src を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="data:image/png;base64,aaa" alt="sample" /></p>';

    const result = sanitizeEditorRuntimeHtml(html, {
      itemId: 'item-runtime',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result.rejectionReport).toHaveLength(0);
    expect(result.sanitizedHtml).toContain('src="data:image/png;base64,aaa"');
  });

  test('preview は data image src を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="data:image/png;base64,aaa" alt="sample" /></p>';

    const result = sanitizeForPreviewRender(html, {
      itemId: 'item-preview',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result.rejectionReport).toHaveLength(0);
    expect(result.sanitizedHtml).toContain('src="data:image/png;base64,aaa"');
  });

  test('preview は非許可の img src を通知レベルで除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="https://example.com/a.png" alt="sample" /></p>';

    const result = sanitizeForPreviewRender(html, {
      itemId: 'item-preview-remote',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[html-sanitizer][通知]'),
    );
    expect(result.rejectionReport).toHaveLength(1);
    expect(result.rejectionReport[0]?.ruleCode).toBe('stripped-src');
    expect(result.sanitizedHtml).toContain('<img alt="sample">');
    expect(result.sanitizedHtml).not.toContain('https://example.com/a.png');
  });

  test('preview は choice-index-mark クラスを除去せず保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html =
      '<p class="ql-indent-2"><span class="choice-index-mark">1．</span>選択肢本文</p>';

    const result = sanitizeForPreviewRender(html, {
      itemId: 'item-choice-mark',
      fieldName: 'questionChoices',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result.rejectionReport).toHaveLength(0);
    expect(result.sanitizedHtml).toContain('class="choice-index-mark"');
    expect(result.sanitizedHtml).toContain('class="ql-indent-2"');
  });
  test('保存時は data image src を通知レベルで除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img src="data:image/png;base64,aaa" alt="sample" /></p>';

    const result = sanitizePersistedHtml(html, {
      boundary: 'save',
      itemId: 'item-save',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[html-sanitizer][通知]'),
    );
    expect(result.rejectionReport).toHaveLength(1);
    expect(result.rejectionReport[0]?.ruleCode).toBe('stripped-src');
    expect(result.sanitizedHtml).toContain('<img alt="sample" />');
    expect(result.sanitizedHtml).not.toContain('src=');
  });

  test('編集中は resize module の img data-size を保持する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img alt="sample" data-size="3390,2285" /></p>';

    const result = sanitizeEditorRuntimeHtml(html, {
      itemId: 'item-runtime-resize',
      fieldName: 'text',
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(result.rejectionReport).toHaveLength(0);
    expect(result.sanitizedHtml).toContain('data-size="3390,2285"');
  });

  test('保存時は img data-size を除去する', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = '<p><img alt="sample" data-size="3390,2285" /></p>';

    const result = sanitizePersistedHtml(html, {
      boundary: 'save',
      itemId: 'item-save-resize',
      fieldName: 'text',
    });

    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[html-sanitizer][警告]'),
    );
    expect(result.rejectionReport).toHaveLength(1);
    expect(result.rejectionReport[0]?.ruleCode).toBe('blocked-attribute');
    expect(result.sanitizedHtml).not.toContain('data-size=');
  });
});

describe('htmlSanitizer の demo-asset URL 許可（設計10.3）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const silenceConsole = () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  };

  const assetHtml = (url: string) => `<p><img src="${url}" alt="sample" /></p>`;

  test('編集中プロファイルは demo-asset URL を保持する', () => {
    silenceConsole();
    const url = 'demo-asset://images/firstGrade/key1.png?v=md5AAA';

    const result = sanitizeEditorRuntimeHtml(assetHtml(url), {
      itemId: 'item-runtime',
      fieldName: 'text',
    });

    expect(result.rejectionReport).toHaveLength(0);
    expect(result.sanitizedHtml).toContain(`src="${url}"`);
  });

  test('プレビュープロファイルは v+r 付き demo-asset URL を保持する', () => {
    silenceConsole();
    const url =
      'demo-asset://images/secondGrade/key1.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA';

    const result = sanitizeForPreviewRender(assetHtml(url), {
      itemId: 'item-preview',
      fieldName: 'text',
    });

    expect(result.rejectionReport).toHaveLength(0);
    // HTML シリアライズで & は &amp; になるが、DOMへ戻したときのURLは同一
    expect(result.sanitizedHtml).toContain(
      'src="demo-asset://images/secondGrade/key1.png?v=md5AAA&amp;r=AAAAAAAAAAAAAAAAAAAAAA"',
    );
  });

  test('保存プロファイルは demo-asset URL を除去する', () => {
    silenceConsole();
    const url = 'demo-asset://images/firstGrade/key1.png?v=md5AAA';

    const result = sanitizePersistedHtml(assetHtml(url), {
      boundary: 'save',
      itemId: 'item-persisted',
      fieldName: 'text',
    });

    expect(result.sanitizedHtml).not.toContain('demo-asset://');
  });

  test('未知query・重複query・逆順query・不正keyの demo-asset URL は許可しない', () => {
    silenceConsole();
    const invalidUrls = [
      'demo-asset://images/firstGrade/key1.png?x=1',
      'demo-asset://images/firstGrade/key1.png?v=a&v=b',
      'demo-asset://images/firstGrade/key1.png?r=AAAAAAAAAAAAAAAAAAAAAA&v=a',
      'demo-asset://images/firstGrade/../secret.png',
      'demo-asset://other/firstGrade/key1.png',
    ];

    for (const url of invalidUrls) {
      const result = sanitizeEditorRuntimeHtml(assetHtml(url), {
        itemId: 'item-runtime',
        fieldName: 'text',
      });
      expect(result.sanitizedHtml).not.toContain(url);
    }
  });
});

describe('htmlSanitizer の外部HTML取込プロファイル（設計10.3）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sanitizeImage = (url: string) =>
    sanitizeForQuillImport(`<p><img src="${url}" alt="sample" /></p>`, {
      itemId: 'item-import',
      fieldName: 'text',
    });

  test('quill-importでは正規のdemo-asset URLを許可する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const urls = [
      'demo-asset://images/firstGrade/key1.png?v=md5AAA',
      'demo-asset://images/secondGrade/key2.png?v=md5BBB&r=AAAAAAAAAAAAAAAAAAAAAA',
    ];

    for (const url of urls) {
      expect(sanitizeImage(url).sanitizedHtml).toContain(
        url.replace('&', '&amp;'),
      );
    }
  });

  test('quill-importでは既知の内部ダミー画像だけをdata URLの例外として許可する', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(sanitizeImage(DUMMY_IMG).sanitizedHtml).toContain(DUMMY_IMG);
    expect(sanitizeImage(EDITOR_DUMMY_IMG).sanitizedHtml).toContain(
      EDITOR_DUMMY_IMG,
    );
    expect(
      sanitizeImage('data:image/png;base64,aaa').sanitizedHtml,
    ).not.toContain('data:image/png;base64,aaa');
  });

  test('quill-importでは不正なdemo-assetと外部画像URLを許可しない', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const urls = [
      'demo-asset://images/firstGrade/key1.png?x=1',
      ' demo-asset://images/firstGrade/key1.png?v=md5AAA ',
      'https://example.com/image.png',
      'blob:https://example.com/id',
      'file:///C:/tmp/image.png',
    ];

    for (const url of urls) {
      expect(sanitizeImage(url).sanitizedHtml).not.toContain(url);
    }
  });
});

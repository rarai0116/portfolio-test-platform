import { describe, expect, it, vi } from 'vitest';
import { DUMMY_IMG, EDITOR_DUMMY_IMG } from './dummyImage';

const { registerMock, importMock } = vi.hoisted(() => ({
  registerMock: vi.fn(),
  importMock: vi.fn(),
}));

class FakeBaseImage {
  static formats() {
    return {};
  }
  format() {}
}

vi.mock('quill', () => ({
  default: {
    import: importMock,
    register: registerMock,
    find: vi.fn(),
  },
}));

import {
  ensureEditorParchmentRegistered,
  setupEditorClipboardMatchers,
} from './editorParchment';

describe('ImageEx の sanitize（設計10.4）', () => {
  it('正規のdemo-assetと既知の内部ダミーだけを許可する', () => {
    class FakeStyleAttributor {
      constructor(
        public name: string,
        public keyName: string,
      ) {}
    }

    importMock.mockImplementation((name: string) => {
      if (name === 'parchment') {
        return {
          Scope: { INLINE: 1 },
          StyleAttributor: FakeStyleAttributor,
        };
      }
      return FakeBaseImage;
    });

    ensureEditorParchmentRegistered();

    // 最後に登録されるのが ImageEx
    const registeredImage = registerMock.mock.calls.at(-1)?.[0] as {
      sanitize: (url: string) => string;
    };

    const assetUrl = 'demo-asset://images/firstGrade/key1.png?v=md5AAA';
    expect(registeredImage.sanitize(assetUrl)).toBe(assetUrl);

    expect(registeredImage.sanitize(DUMMY_IMG)).toBe(DUMMY_IMG);
    expect(registeredImage.sanitize(EDITOR_DUMMY_IMG)).toBe(EDITOR_DUMMY_IMG);

    const invalidUrls = [
      'demo-asset://images/firstGrade/key1.png?x=1',
      'data:image/png;base64,aaa',
      'https://example.com/image.png',
      'blob:https://example.com/id',
    ];
    for (const invalid of invalidUrls) {
      expect(registeredImage.sanitize(invalid)).toBe('//:0');
    }
  });
});

describe('Quill IMG clipboard matcher', () => {
  const setupMatcher = () => {
    const addMatcher = vi.fn();
    setupEditorClipboardMatchers({ clipboard: { addMatcher } } as never);
    return addMatcher.mock.calls[0]?.[1] as (
      node: HTMLElement,
      delta: {
        ops: Array<{
          insert: string | { image: string };
          attributes?: Record<string, string>;
        }>;
      },
    ) => {
      ops: Array<{
        insert: string | { image: string };
        attributes?: Record<string, string>;
      }>;
    };
  };

  it('正規のdemo-asset画像を保持して既存の画像書式を引き継ぐ', () => {
    const matcher = setupMatcher();
    const image = document.createElement('img');
    const url = 'demo-asset://images/firstGrade/key1.png?v=md5AAA';
    image.src = url;
    image.setAttribute('width', '320');

    const result = matcher(image, { ops: [{ insert: { image: url } }] });

    expect(result.ops).toEqual([
      { insert: { image: url }, attributes: { width: '320' } },
    ]);
  });

  it('外部画像のopだけを除去し、同時に貼り付けたテキストは保持する', () => {
    const matcher = setupMatcher();
    const image = document.createElement('img');
    const url = 'data:image/png;base64,external';
    image.src = url;

    const result = matcher(image, {
      ops: [{ insert: { image: url } }, { insert: 'text' }],
    });

    expect(result.ops).toEqual([{ insert: 'text' }]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseImgTagAttributes } from './utils';

describe('imgタグ属性の正規表現抽出', () => {
  it('二重引用符・単一引用符・未引用・ブール属性を抽出できる', () => {
    const tag =
      '<img src="data:image/png;base64,AAA" alt=\'a b\' width=100 height=200 loading />';
    const attrs = parseImgTagAttributes(tag);
    expect(attrs?.src).toContain('data:image/png');
    expect(attrs?.alt).toBe('a b');
    expect(attrs?.width).toBe('100');
    expect(attrs?.height).toBe('200');
    expect(attrs?.loading).toBe(true);
  });

  it('HTMLエンティティをデコードする', () => {
    const tag = '<img title="Tom &amp; Jerry" data-x=\'&lt;div&gt;\' />';
    const attrs = parseImgTagAttributes(tag);
    expect(attrs?.title).toBe('Tom & Jerry');
    expect(attrs?.['data-x']).toBe('<div>');
  });

  it('imgタグでない場合はnullを返す', () => {
    expect(parseImgTagAttributes('<div></div>')).toBeNull();
  });
});

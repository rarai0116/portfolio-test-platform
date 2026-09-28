import { describe, expect, it } from 'vitest';
import { realizeDomImages } from './imageRealizer';

describe('realizeDomImages', () => {
  it('サイズ未設定画像では文字エラーを追加せず、状態属性だけを付ける', () => {
    document.body.innerHTML = '<p><img alt="image-1" /></p>';

    realizeDomImages(document.body, {
      'image-1': { url: 'demo-asset://images/firstGrade/image-1.png?v=md5AAA', contentType: 'image/png' },
    });

    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('demo-asset://images/firstGrade/image-1.png?v=md5AAA');
    expect(img?.getAttribute('data-preview-image-error')).toBe('missing-size');
    expect(document.body.textContent).not.toContain('画像サイズ未設定');
    expect(document.querySelector('.preview-image-error')).toBeNull();
  });

  it('サイズが解決できた画像では既存のサイズ未設定表示を消す', () => {
    document.body.innerHTML =
      '<p><img alt="image-1" data-preview-image-error="missing-size" /><span class="preview-image-error" data-preview-image-error-for="image-1">[画像サイズ未設定: image-1]</span></p>';

    realizeDomImages(document.body, {
      'image-1': {
        url: 'demo-asset://images/firstGrade/image-1.png?v=md5AAA',
        contentType: 'image/png',
        width: 120,
        height: 80,
      },
    });

    const img = document.querySelector('img');
    expect(img?.getAttribute('data-preview-image-error')).toBeNull();
    expect(img?.getAttribute('width')).toBe('120');
    expect(img?.getAttribute('height')).toBe('80');
    expect(document.querySelector('.preview-image-error')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { buildAssetUrl, parseAssetUrl } from './assets';

describe('buildAssetUrl', () => {
  it('queryなし、v付き、r付き、v+r付きのURLを生成する', () => {
    expect(buildAssetUrl({ grade: 'firstGrade', key: 'abc_123-XYZ' })).toBe(
      'demo-asset://images/firstGrade/abc_123-XYZ.png',
    );
    expect(
      buildAssetUrl({ grade: 'secondGrade', key: 'k1', version: 'v1' }),
    ).toBe('demo-asset://images/secondGrade/k1.png?v=v1');
    expect(
      buildAssetUrl({
        grade: 'firstGrade',
        key: 'k1',
        recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toBe('demo-asset://images/firstGrade/k1.png?r=AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('v と r の両方がある場合は v→r の順で並べる', () => {
    expect(
      buildAssetUrl({
        grade: 'firstGrade',
        key: 'k1',
        version: 'md5Value',
        recoveryToken: 'BBBBBBBBBBBBBBBBBBBBBB',
      }),
    ).toBe(
      'demo-asset://images/firstGrade/k1.png?v=md5Value&r=BBBBBBBBBBBBBBBBBBBBBB',
    );
  });

  it('不正な grade / key / version / token では例外を投げる', () => {
    expect(() =>
      buildAssetUrl({
        grade: 'thirdGrade' as 'firstGrade',
        key: 'k1',
      }),
    ).toThrow();
    expect(() =>
      buildAssetUrl({ grade: 'firstGrade', key: '../etc' }),
    ).toThrow();
    expect(() => buildAssetUrl({ grade: 'firstGrade', key: '' })).toThrow();
    expect(() =>
      buildAssetUrl({ grade: 'firstGrade', key: 'k1', version: 'has space' }),
    ).toThrow();
    expect(() =>
      buildAssetUrl({ grade: 'firstGrade', key: 'k1', recoveryToken: 'short' }),
    ).toThrow();
  });
});

describe('parseAssetUrl', () => {
  it('queryなし、v、r、v+r を分解できる', () => {
    expect(parseAssetUrl('demo-asset://images/firstGrade/k1.png')).toEqual({
      grade: 'firstGrade',
      key: 'k1',
    });
    expect(parseAssetUrl('demo-asset://images/secondGrade/k1.png?v=v1')).toEqual(
      {
        grade: 'secondGrade',
        key: 'k1',
        version: 'v1',
      },
    );
    expect(
      parseAssetUrl(
        'demo-asset://images/firstGrade/k1.png?r=AAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toEqual({
      grade: 'firstGrade',
      key: 'k1',
      recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(
      parseAssetUrl(
        'demo-asset://images/firstGrade/k1.png?v=v1&r=AAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toEqual({
      grade: 'firstGrade',
      key: 'k1',
      version: 'v1',
      recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    });
  });

  it('buildAssetUrl の出力を往復できる', () => {
    const notice = {
      grade: 'secondGrade' as const,
      key: 'round_trip-1',
      version: 'abcDEF123_-',
      recoveryToken: 'CCCCCCCCCCCCCCCCCCCCCC',
    };
    expect(parseAssetUrl(buildAssetUrl(notice))).toEqual(notice);
  });

  it('不正なホスト、スキーム、拡張子を拒否する', () => {
    expect(parseAssetUrl('demo-asset://other/firstGrade/k1.png')).toBeNull();
    expect(parseAssetUrl('http://images/firstGrade/k1.png')).toBeNull();
    expect(parseAssetUrl('demo-asset://images/firstGrade/k1.jpg')).toBeNull();
    expect(parseAssetUrl('demo-asset://images/firstGrade/k1')).toBeNull();
  });

  it('不正な grade / key とパストラバーサルを拒否する', () => {
    expect(parseAssetUrl('demo-asset://images/thirdGrade/k1.png')).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/../../secret.png'),
    ).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/sub/k1.png'),
    ).toBeNull();
    expect(
      parseAssetUrl(`demo-asset://images/firstGrade/${'a'.repeat(65)}.png`),
    ).toBeNull();
  });

  it('未知query、重複query、逆順query、fragment を拒否する', () => {
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?x=1'),
    ).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=v1&v=v2'),
    ).toBeNull();
    expect(
      parseAssetUrl(
        'demo-asset://images/firstGrade/k1.png?r=AAAAAAAAAAAAAAAAAAAAAA&v=v1',
      ),
    ).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=v1&x=1'),
    ).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=v1#frag'),
    ).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=v1?v=v2'),
    ).toBeNull();
  });

  it('不正な version / recoveryToken を拒否する', () => {
    expect(parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=')).toBeNull();
    expect(
      parseAssetUrl('demo-asset://images/firstGrade/k1.png?v=has%20space'),
    ).toBeNull();
    // r は128bit base64url の22文字固定
    expect(
      parseAssetUrl(
        'demo-asset://images/firstGrade/k1.png?r=AAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBeNull();
    expect(
      parseAssetUrl(
        'demo-asset://images/firstGrade/k1.png?r=AAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toBeNull();
  });
});

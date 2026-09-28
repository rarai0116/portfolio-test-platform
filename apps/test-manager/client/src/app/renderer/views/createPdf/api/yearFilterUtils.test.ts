import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import { buildNosMapFromTestData, sortYearLabelsDesc } from './yearFilterUtils';

// ─── テスト用ヘルパー ──────────────────────────────────────────────────────────

const makeTestData = (no: number, nengo: string, year: string): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '',
  ch1: '',
  ch2: '',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo,
  no,
  parentNo: 0,
  smallCategoryTag: '',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year,
});

// ─── sortYearLabelsDesc ────────────────────────────────────────────────────────

describe('sortYearLabelsDesc', () => {
  it('令和・平成・昭和が混在する場合、令和 > 平成 > 昭和の順に並ぶ', () => {
    const input = ['昭和63年', '平成元年', '令和3年', '平成30年', '令和元年'];
    const result = sortYearLabelsDesc(input);
    expect(result).toEqual([
      '令和3年',
      '令和元年',
      '平成30年',
      '平成元年',
      '昭和63年',
    ]);
  });

  it('同じ元号内では年度の大きい順に並ぶ', () => {
    const input = ['令和元年', '令和5年', '令和2年'];
    const result = sortYearLabelsDesc(input);
    expect(result).toEqual(['令和5年', '令和2年', '令和元年']);
  });

  it('認識できない元号は最も古い扱いになる', () => {
    const input = ['令和3年', '未知元号1年'];
    const result = sortYearLabelsDesc(input);
    expect(result[0]).toBe('令和3年');
    expect(result[1]).toBe('未知元号1年');
  });

  it('空配列を渡した場合は空配列を返す', () => {
    expect(sortYearLabelsDesc([])).toEqual([]);
  });

  it('元の配列を変更しない（immutable）', () => {
    const input = ['平成2年', '令和1年'];
    const original = [...input];
    sortYearLabelsDesc(input);
    expect(input).toEqual(original);
  });
});

// ─── buildNosMapFromTestData ───────────────────────────────────────────────────

describe('buildNosMapFromTestData', () => {
  it('nengo と year が揃った TestData がラベルにマッピングされる', () => {
    const map = new Map([
      [1, makeTestData(1, '令和', '3年')],
      [2, makeTestData(2, '令和', '3年')],
      [3, makeTestData(3, '平成', '30年')],
    ]);

    const result = buildNosMapFromTestData(map);

    expect(result.size).toBe(2);
    expect(result.get('令和3年')).toEqual(expect.arrayContaining([1, 2]));
    expect(result.get('令和3年')).toHaveLength(2);
    expect(result.get('平成30年')).toEqual([3]);
  });

  it('nengo が空文字の TestData は除外される', () => {
    const map = new Map([
      [1, makeTestData(1, '', '3年')],
      [2, makeTestData(2, '令和', '3年')],
    ]);

    const result = buildNosMapFromTestData(map);

    expect(result.size).toBe(1);
    expect(result.get('令和3年')).toEqual([2]);
  });

  it('year が空文字の TestData は除外される', () => {
    const map = new Map([
      [1, makeTestData(1, '令和', '')],
      [2, makeTestData(2, '令和', '3年')],
    ]);

    const result = buildNosMapFromTestData(map);

    expect(result.size).toBe(1);
    expect(result.get('令和3年')).toEqual([2]);
  });

  it('空のマップを渡した場合は空の ReadonlyMap を返す', () => {
    const result = buildNosMapFromTestData(new Map());
    expect(result.size).toBe(0);
  });

  it('ラベルキーは nengo + year を結合した文字列になる', () => {
    const map = new Map([[1, makeTestData(1, '平成', '元年')]]);
    const result = buildNosMapFromTestData(map);
    expect(result.has('平成元年')).toBe(true);
  });
});

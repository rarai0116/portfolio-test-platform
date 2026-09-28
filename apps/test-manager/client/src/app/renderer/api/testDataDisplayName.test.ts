import { describe, expect, it } from 'vitest';

import { buildTestDataDisplayName } from './testDataDisplayName';

describe('buildTestDataDisplayName', () => {
  it('既存問題は "{year}_{subject}_No{testNo}" 形式にする', () => {
    expect(
      buildTestDataDisplayName({
        isOriginal: false,
        subject: '学科Ⅰ',
        no: 10,
        nengo: '令和',
        year: '6',
        testNo: '3',
      }),
    ).toBe('令和6_学科Ⅰ_No3');
  });

  it('一覧の表示年を渡しても同じ形式にする', () => {
    expect(
      buildTestDataDisplayName({
        isOriginal: false,
        subject: '学科Ⅱ',
        no: 20,
        year: '令和5',
        testNo: '7',
      }),
    ).toBe('令和5_学科Ⅱ_No7');
  });

  it('オリジナル問題は "{subject} No.{no}" 形式にする', () => {
    expect(
      buildTestDataDisplayName({
        isOriginal: true,
        subject: '学科Ⅲ',
        no: 30,
        year: '令和4',
        testNo: '9',
      }),
    ).toBe('学科Ⅲ No.30');
  });

  it('既存問題の年と問題Noが空の場合はフォールバックを使う', () => {
    expect(
      buildTestDataDisplayName({
        isOriginal: false,
        subject: '学科Ⅳ',
        no: 40,
        nengo: '',
        year: '',
        testNo: '',
      }),
    ).toBe('不明年度_学科Ⅳ_No不明');
  });
});

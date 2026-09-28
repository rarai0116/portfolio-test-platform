import type { TestData } from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import type { CandidateEntry } from './candidateIndex';
import {
  buildBigCategoryKey,
  buildCandidateIndex,
  buildSmallCategoryKey,
  calcQaaAnswerBool,
  getCandidates,
  getChoiceIndices,
  hasChoiceHtml,
  resolveCandidates,
  toCandidateKey,
} from './candidateIndex';

// テスト用 TestData ファクトリ
const baseTestData = (
  no: number,
  overrides: Partial<TestData> = {},
): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '大分類A',
  ch1: '選択肢1',
  ch2: '選択肢2',
  ch3: '選択肢3',
  ch4: '選択肢4',
  ch5: '選択肢5',
  difficult: '1',
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: '',
  no,
  parentNo: 0,
  smallCategoryTag: '小分類A-1',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year: '2024',
  ...overrides,
});

const defaultOptions = {
  excludedTagIds: [],
  excludePastExam: false,
  excludeOriginal: false,
  isShuffleChoices: false,
  shuffleSeed: null,
};

const makeMap = (...rows: TestData[]): ReadonlyMap<number, TestData> =>
  new Map(rows.map((d) => [d.no, d]));

/** CandidateEntry 配列の no 一覧を取り出して昇順ソート（順序非依存な比較に使用） */
const nos = (entries: readonly CandidateEntry[] | undefined): number[] =>
  (entries ?? []).map((e) => e.no).sort((a, b) => a - b);

// ─────────────────────────────────────────────
describe('toCandidateKey', () => {
  it('choiceIndex が数値の場合: "No:choiceIndex" 形式で返す', () => {
    expect(toCandidateKey(1, 0)).toBe('1:null');
    expect(toCandidateKey(42, 3)).toBe('42:3');
  });

  it('choiceIndex が null の場合: "No:null" 形式で返す', () => {
    expect(toCandidateKey(1, null)).toBe('1:null');
    expect(toCandidateKey(99, null)).toBe('99:null');
  });
});

// ─────────────────────────────────────────────
describe('hasChoiceHtml', () => {
  it('対応するフィールドが非空文字列の場合 true を返す', () => {
    expect(hasChoiceHtml(baseTestData(1, { ch1: '選択肢' }), 1)).toBe(true);
    expect(hasChoiceHtml(baseTestData(1, { ch5: 'X' }), 5)).toBe(true);
  });

  it('対応するフィールドが空文字列またはスペースのみの場合 false を返す', () => {
    expect(hasChoiceHtml(baseTestData(1, { ch1: '' }), 1)).toBe(false);
    expect(hasChoiceHtml(baseTestData(1, { ch2: '  ' }), 2)).toBe(false);
  });

  it('インデックスが範囲外の場合 false を返す', () => {
    expect(hasChoiceHtml(baseTestData(1), 0)).toBe(false);
    expect(hasChoiceHtml(baseTestData(1), 6)).toBe(false);
    expect(hasChoiceHtml(baseTestData(1), 10)).toBe(false);
  });
});

// ─────────────────────────────────────────────
describe('calcQaaAnswerBool', () => {
  it('isNegativeAnswer=false: answerNumber と一致する choiceIndex が true を返す', () => {
    // answerNumber='1' → choiceIndex=1 (ch1) が正解
    const d = baseTestData(1, { answerNumber: '1', isNegativeAnswer: false });
    expect(calcQaaAnswerBool(d, 1)).toBe(true);
    expect(calcQaaAnswerBool(d, 2)).toBe(false);
    expect(calcQaaAnswerBool(d, 3)).toBe(false);
  });

  it('isNegativeAnswer=true: answerNumber と一致する choiceIndex が false を返す', () => {
    // 「誤っているものを選べ」問題: answerNumber に対応する選択肢が誤り(×)
    const d = baseTestData(1, { answerNumber: '1', isNegativeAnswer: true });
    expect(calcQaaAnswerBool(d, 1)).toBe(false); // ch1 = × (誤り)
    expect(calcQaaAnswerBool(d, 2)).toBe(true);
    expect(calcQaaAnswerBool(d, 3)).toBe(true);
  });
});

// ─────────────────────────────────────────────
describe('getChoiceIndices', () => {
  it('grade=1 は [1,2,3,4] を返す', () => {
    expect(getChoiceIndices(1)).toEqual([1, 2, 3, 4]);
  });

  it('grade=2 は [1,2,3,4,5] を返す', () => {
    expect(getChoiceIndices(2)).toEqual([1, 2, 3, 4, 5]);
  });
});
// ─────────────────────────────────────────────
describe('buildSmallCategoryKey', () => {
  it('small が null の場合は空文字になる', () => {
    expect(buildSmallCategoryKey('学科Ⅰ', '大分類A', null)).toBe(
      '学科Ⅰ::大分類A::',
    );
  });

  it('small が非 null の場合はそのまま使われる', () => {
    expect(buildSmallCategoryKey('学科Ⅰ', '大分類A', '小分類A-1')).toBe(
      '学科Ⅰ::大分類A::小分類A-1',
    );
  });
});

describe('buildBigCategoryKey', () => {
  it('"subject::big" の形式を返す', () => {
    expect(buildBigCategoryKey('学科Ⅰ', '大分類A')).toBe('学科Ⅰ::大分類A');
  });
});

// ─────────────────────────────────────────────
describe('buildCandidateIndex', () => {
  describe('status フィルタ', () => {
    it("status が '準備完了' でない問題は除外される", () => {
      const map = makeMap(
        baseTestData(1, { status: '準備完了' }),
        baseTestData(2, { status: '準備中' }),
        baseTestData(3, { status: 'エラー' }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: null },
      ]);
    });
  });

  describe('workbookMode フィルタ', () => {
    it('qaa 系では isConvertibleQaa=false の問題が除外される', () => {
      const map = makeMap(
        baseTestData(1, { isConvertibleQaa: true }),
        baseTestData(2, { isConvertibleQaa: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 1,
        options: defaultOptions,
      });
      const entries = index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1');
      // no=1 のみ残る（isConvertibleQaa=false の no=2 は除外）
      expect(entries?.every((e) => e.no === 1)).toBe(true);
    });

    it('multipleChoice では isConvertibleQaa に関わらず含まれる', () => {
      const map = makeMap(
        baseTestData(1, { isConvertibleQaa: true }),
        baseTestData(2, { isConvertibleQaa: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'multipleChoice',
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: null },
        { no: 2, choiceIndex: null },
      ]);
    });

    it('workbookMode 未指定では isConvertibleQaa に関わらず含まれる', () => {
      const map = makeMap(
        baseTestData(1, { isConvertibleQaa: true }),
        baseTestData(2, { isConvertibleQaa: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: null },
        { no: 2, choiceIndex: null },
      ]);
    });

    it('qaaAllTrue / qaaAllFalse でも isConvertibleQaa=false は除外される', () => {
      const map = makeMap(
        baseTestData(1, { isConvertibleQaa: true }),
        baseTestData(2, { isConvertibleQaa: false }),
      );
      for (const mode of ['qaaAllTrue', 'qaaAllFalse'] as const) {
        const index = buildCandidateIndex({
          testDataByNo: map,
          workbookMode: mode,
          grade: 1,
          options: defaultOptions,
        });
        const entries = index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1');
        expect(
          entries?.every((e) => e.no === 1),
          `mode: ${mode}`,
        ).toBe(true);
      }
    });
  });

  describe('タグ除外フィルタ', () => {
    it('otherTags に excludedTagIds の値が含まれる問題は除外される', () => {
      const map = makeMap(
        baseTestData(1, { otherTags: ['法規', '計画'] }),
        baseTestData(2, { otherTags: ['設備'] }),
        baseTestData(3, { otherTags: [] }),
        baseTestData(4),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: { ...defaultOptions, excludedTagIds: ['法規'] },
      });
      expect(
        nos(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')),
      ).toEqual([2, 3, 4]);
    });

    it('excludedTagIds が空の場合はタグフィルタをかけない', () => {
      const map = makeMap(
        baseTestData(1, { otherTags: ['法規'] }),
        baseTestData(2),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(
        nos(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')),
      ).toEqual([1, 2]);
    });
  });

  describe('過去問・オリジナル除外フィルタ', () => {
    it('excludePastExam=true で isOriginal !== true の問題（過去問）が除外される', () => {
      const map = makeMap(
        baseTestData(1, { isOriginal: true }),
        baseTestData(2, { isOriginal: false }),
        baseTestData(3), // isOriginal 未定義 = 過去問扱い
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: { ...defaultOptions, excludePastExam: true },
      });
      expect(
        nos(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')),
      ).toEqual([1]);
    });

    it('excludeOriginal=true で isOriginal === true の問題が除外される', () => {
      const map = makeMap(
        baseTestData(1, { isOriginal: true }),
        baseTestData(2, { isOriginal: false }),
        baseTestData(3), // isOriginal 未定義
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: { ...defaultOptions, excludeOriginal: true },
      });
      expect(
        nos(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')),
      ).toEqual([2, 3]);
    });

    it('excludePastExam と excludeOriginal を同時指定すると両方除外される', () => {
      const map = makeMap(
        baseTestData(1, { isOriginal: true }),
        baseTestData(2, { isOriginal: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: {
          ...defaultOptions,
          excludePastExam: true,
          excludeOriginal: true,
        },
      });
      // 過去問もオリジナルも除外されるため結果は空
      expect(
        index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1'),
      ).toBeUndefined();
    });
  });

  describe('インデックス構造', () => {
    it('bySmallCategory / byBigCategory / byDifficulty が正しく構築される', () => {
      const map = makeMap(
        baseTestData(1, {
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-1',
          difficult: '1',
        }),
        baseTestData(2, {
          subject: '学科Ⅰ',
          bigCategoryTag: '大分類A',
          smallCategoryTag: '小分類A-2',
          difficult: '2',
        }),
        baseTestData(3, {
          subject: '学科Ⅱ',
          bigCategoryTag: '大分類B',
          smallCategoryTag: '小分類B-1',
          difficult: '1',
        }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });

      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: null },
      ]);
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-2')).toEqual([
        { no: 2, choiceIndex: null },
      ]);
      expect(index.bySmallCategory.get('学科Ⅱ::大分類B::小分類B-1')).toEqual([
        { no: 3, choiceIndex: null },
      ]);

      expect(index.byBigCategory.get('学科Ⅰ::大分類A')).toEqual([
        { no: 1, choiceIndex: null },
        { no: 2, choiceIndex: null },
      ]);
      expect(index.byBigCategory.get('学科Ⅱ::大分類B')).toEqual([
        { no: 3, choiceIndex: null },
      ]);

      expect(index.byDifficulty.get('学科Ⅰ::大分類A::小分類A-1::1')).toEqual([
        { no: 1, choiceIndex: null },
      ]);
      expect(index.byDifficulty.get('学科Ⅰ::大分類A::小分類A-2::2')).toEqual([
        { no: 2, choiceIndex: null },
      ]);
    });

    it('byNo は元の testDataByNo を参照する', () => {
      const map = makeMap(baseTestData(1));
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(index.byNo).toBe(map);
    });

    it('安定順を維持する（シャッフルなし）', () => {
      // 同一カテゴリに no=1,2,3 を挿入 → 取り出し順は 1,2,3 であるべき
      const map = makeMap(baseTestData(1), baseTestData(2), baseTestData(3));
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: null },
        { no: 2, choiceIndex: null },
        { no: 3, choiceIndex: null },
      ]);
    });

    it('entriesByNo が構築される（multipleChoice: choiceIndex=null）', () => {
      const map = makeMap(baseTestData(1));
      const index = buildCandidateIndex({
        testDataByNo: map,
        options: defaultOptions,
      });
      expect(index.entriesByNo.get(1)).toEqual([{ no: 1, choiceIndex: null }]);
    });

    it('qaa 系: entriesByNo に選択肢エントリが登録される', () => {
      const map = makeMap(
        baseTestData(1, { answerNumber: '1', isNegativeAnswer: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 1,
        options: defaultOptions,
      });
      expect(index.entriesByNo.get(1)).toEqual([
        { no: 1, choiceIndex: 1 },
        { no: 1, choiceIndex: 2 },
        { no: 1, choiceIndex: 3 },
        { no: 1, choiceIndex: 4 },
      ]);
    });
  });

  describe('qaa 系での選択肢展開', () => {
    it('grade=1 の qaa: ch1〜ch4 が CandidateEntry に展開される（ch5 は除外）', () => {
      // baseTestData では ch1〜ch5 全て非空。grade=1 → getChoiceIndices(1)=[1,2,3,4]
      const map = makeMap(baseTestData(1));
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 1,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: 1 },
        { no: 1, choiceIndex: 2 },
        { no: 1, choiceIndex: 3 },
        { no: 1, choiceIndex: 4 },
      ]);
    });

    it('grade=2 の qaa: ch1〜ch5 が CandidateEntry に展開される', () => {
      const map = makeMap(baseTestData(1));
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 2,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: 1 },
        { no: 1, choiceIndex: 2 },
        { no: 1, choiceIndex: 3 },
        { no: 1, choiceIndex: 4 },
        { no: 1, choiceIndex: 5 },
      ]);
    });

    it('空の選択肢（ch が空文字）は除外される', () => {
      // ch3 を空にする → choiceIndex=3 は除外
      const map = makeMap(baseTestData(1, { ch3: '' }));
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 1,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: 1 },
        { no: 1, choiceIndex: 2 },
        { no: 1, choiceIndex: 4 },
      ]);
    });

    it('有効選択肢が 0 件の問題はインデックスに登録されない', () => {
      const map = makeMap(
        baseTestData(1, { ch1: '', ch2: '', ch3: '', ch4: '' }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaa',
        grade: 1,
        options: defaultOptions,
      });
      expect(
        index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1'),
      ).toBeUndefined();
    });

    it('qaaAllTrue: 正解選択肢（answerBool=true）のみが展開される', () => {
      // answerNumber='1' + isNegativeAnswer=false → choiceIndex=1 のみが○
      const map = makeMap(
        baseTestData(1, { answerNumber: '1', isNegativeAnswer: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaaAllTrue',
        grade: 1,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: 1 },
      ]);
    });

    it('qaaAllFalse: 不正解選択肢（answerBool=false）のみが展開される', () => {
      // answerNumber='1' + isNegativeAnswer=false → choiceIndex=2,3,4 が×
      const map = makeMap(
        baseTestData(1, { answerNumber: '1', isNegativeAnswer: false }),
      );
      const index = buildCandidateIndex({
        testDataByNo: map,
        workbookMode: 'qaaAllFalse',
        grade: 1,
        options: defaultOptions,
      });
      expect(index.bySmallCategory.get('学科Ⅰ::大分類A::小分類A-1')).toEqual([
        { no: 1, choiceIndex: 2 },
        { no: 1, choiceIndex: 3 },
        { no: 1, choiceIndex: 4 },
      ]);
    });

    it('qaa 系かつ grade 未指定の場合は throw Error', () => {
      const map = makeMap(baseTestData(1));
      expect(() =>
        buildCandidateIndex({
          testDataByNo: map,
          workbookMode: 'qaa',
          // grade を渡さない
          options: defaultOptions,
        }),
      ).toThrow();
    });

    it('qaaAllTrue / qaaAllFalse でも grade 未指定は throw Error', () => {
      const map = makeMap(baseTestData(1));
      for (const mode of ['qaaAllTrue', 'qaaAllFalse'] as const) {
        expect(
          () =>
            buildCandidateIndex({
              testDataByNo: map,
              workbookMode: mode,
              options: defaultOptions,
            }),
          `mode: ${mode}`,
        ).toThrow();
      }
    });
  });
});

// ─────────────────────────────────────────────
describe('resolveCandidates', () => {
  const makeIndex = (...rows: TestData[]) =>
    buildCandidateIndex({
      testDataByNo: makeMap(...rows),
      options: defaultOptions,
    });

  it('単一の OR 条件（small 指定あり）で対応する候補を返す', () => {
    const index = makeIndex(
      baseTestData(1, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-2',
      }),
    );
    const result = resolveCandidates(index, '学科Ⅰ', [
      { big: '大分類A', small: '小分類A-1' },
    ]);
    expect(result).toEqual([{ no: 1, choiceIndex: null }]);
  });

  it('OR 条件複数件では union が返る（重複なし）', () => {
    const index = makeIndex(
      baseTestData(1, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-2',
      }),
    );
    const result = resolveCandidates(index, '学科Ⅰ', [
      { big: '大分類A', small: '小分類A-1' },
      { big: '大分類A', small: '小分類A-2' },
    ]);
    expect(result.map((e) => e.no).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('conditions が空の場合、その subject の全候補を返す', () => {
    const index = makeIndex(
      baseTestData(1, {
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類B',
        smallCategoryTag: '小分類B-1',
      }),
      baseTestData(3, {
        subject: '学科Ⅱ',
        bigCategoryTag: '大分類C',
        smallCategoryTag: '小分類C-1',
      }),
    );
    const result = resolveCandidates(index, '学科Ⅰ', []);
    expect(result.map((e) => e.no).sort((a, b) => a - b)).toEqual([1, 2]);
    // 学科Ⅱ は含まれない
    expect(result.every((e) => e.no !== 3)).toBe(true);
  });

  it('small が null の条件では byBigCategory から取得する', () => {
    const index = makeIndex(
      baseTestData(1, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-2',
      }),
      baseTestData(3, {
        bigCategoryTag: '大分類B',
        smallCategoryTag: '小分類B-1',
      }),
    );
    const result = resolveCandidates(index, '学科Ⅰ', [
      { big: '大分類A', small: null },
    ]);
    expect(result.map((e) => e.no).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(result.every((e) => e.no !== 3)).toBe(true);
  });

  it('存在しない条件キーは空配列を返す', () => {
    const index = makeIndex(baseTestData(1));
    const result = resolveCandidates(index, '学科Ⅰ', [
      { big: '存在しない大分類', small: '存在しない小分類' },
    ]);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────
describe('getCandidates', () => {
  const makeIndex = (...rows: TestData[]) =>
    buildCandidateIndex({
      testDataByNo: makeMap(...rows),
      options: defaultOptions,
    });

  it('big と small が指定されている場合 bySmallCategory から返す', () => {
    const index = makeIndex(
      baseTestData(1, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-2',
      }),
    );
    expect(getCandidates(index, '学科Ⅰ', '大分類A', '小分類A-1')).toEqual([
      { no: 1, choiceIndex: null },
    ]);
  });

  it('small が null の場合 byBigCategory から返す', () => {
    const index = makeIndex(
      baseTestData(1, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-2',
      }),
    );
    const result = getCandidates(index, '学科Ⅰ', '大分類A', null);
    expect(result.map((e) => e.no).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('big が null の場合 subject 全体を返す', () => {
    const index = makeIndex(
      baseTestData(1, {
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類A',
        smallCategoryTag: '小分類A-1',
      }),
      baseTestData(2, {
        subject: '学科Ⅰ',
        bigCategoryTag: '大分類B',
        smallCategoryTag: '小分類B-1',
      }),
      baseTestData(3, {
        subject: '学科Ⅱ',
        bigCategoryTag: '大分類C',
        smallCategoryTag: '小分類C-1',
      }),
    );
    const result = getCandidates(index, '学科Ⅰ', null, null);
    expect(result.map((e) => e.no).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(result.every((e) => e.no !== 3)).toBe(true);
  });
});

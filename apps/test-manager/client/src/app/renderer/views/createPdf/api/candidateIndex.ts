import type { TestData } from '@shared/types/contracts';
import type {
  CategoryCondition,
  CreatePdfCommonOptionDraftState,
} from '@views/createPdf/types/draftState';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

/** カテゴリキー "subject::big::small" (small が null/'' なら '') */
export const buildSmallCategoryKey = (
  subject: string,
  big: string,
  small: string | null,
): string => `${subject}::${big}::${small ?? ''}`;

/** カテゴリキー "subject::big" */
export const buildBigCategoryKey = (subject: string, big: string): string =>
  `${subject}::${big}`;

/** カテゴリキー "subject::big::small::difficult" */
export const buildDifficultyKey = (
  subject: string,
  big: string,
  small: string | null,
  difficult: string,
): string => `${subject}::${big}::${small ?? ''}::${difficult}`;

/** 抽選の基本単位。qaa系では (no, choiceIndex) ペア、それ以外は (no, null) */
export type CandidateEntry = {
  no: number;
  /** qaa系: 1始まり選択肢番号、それ以外: null。0 は null と同等に扱う */
  choiceIndex: number | null;
};

export const normalizeQaaChoiceIndex = (
  choiceIndex: number | null,
): number | null =>
  choiceIndex === null || choiceIndex === 0 ? null : choiceIndex;

/** 重複排除キー: "No:choiceIndex" または "No:null" */
export const toCandidateKey = (
  no: number,
  choiceIndex: number | null,
): string => {
  const normalized = normalizeQaaChoiceIndex(choiceIndex);
  return normalized !== null ? `${no}:${normalized}` : `${no}:null`;
};

/** 選択肢番号（1始まり）に有効な HTML が存在するか */
export const hasChoiceHtml = (
  source: TestData,
  choiceIndex: number,
): boolean => {
  const fields = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
  const field = fields[choiceIndex - 1];
  return field !== undefined && String(source[field] ?? '').trim().length > 0;
};

/** 選択肢インデックスに対応する answerBool を返す（isNegativeAnswer を考慮） */
export const calcQaaAnswerBool = (
  source: TestData,
  choiceIndex: number,
): boolean => {
  const choiceNo = choiceIndex;
  const isMatchingAnswer = choiceNo === Number(source.answerNumber);
  return source.isNegativeAnswer ? !isMatchingAnswer : isMatchingAnswer;
};

/** grade に対応する選択肢番号一覧（1始まり）を返す */
export const getChoiceIndices = (grade: 1 | 2): readonly number[] =>
  grade === 1 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];

export type CandidateIndex = {
  /** "subject::big::small" → 候補エントリ（安定順・シャッフルなし） */
  bySmallCategory: ReadonlyMap<string, readonly CandidateEntry[]>;
  /** "subject::big" → 候補エントリ */
  byBigCategory: ReadonlyMap<string, readonly CandidateEntry[]>;
  /** "subject::big::small::difficult" → 候補エントリ */
  byDifficulty: ReadonlyMap<string, readonly CandidateEntry[]>;
  /** 固定行メタ参照用。出題年フィルタでは絞らない */
  allByNo: ReadonlyMap<number, TestData>;
  /** 非固定候補用。出題年・タグ除外などを反映した候補 */
  candidateEntriesByNo: ReadonlyMap<number, readonly CandidateEntry[]>;
  /** 固定行の qaa choice 再割り当て用。出題年・タグ除外などは無視する */
  fixedEntriesByNo: ReadonlyMap<number, readonly CandidateEntry[]>;
  /** 互換フィールド。移行中は allByNo の alias として扱う */
  byNo: ReadonlyMap<number, TestData>;
  /** 互換フィールド。移行中は fixedEntriesByNo の alias として扱う */
  entriesByNo: ReadonlyMap<number, readonly CandidateEntry[]>;
};

const buildFixedEntriesByNo = (params: {
  testDataByNo: ReadonlyMap<number, TestData>;
  workbookMode?: WorkbookMode;
  grade?: 1 | 2;
}): ReadonlyMap<number, readonly CandidateEntry[]> => {
  const { testDataByNo, workbookMode, grade } = params;
  const isQaaMode =
    workbookMode !== undefined && workbookMode !== 'multipleChoice';
  const entriesByNo = new Map<number, CandidateEntry[]>();

  for (const testData of testDataByNo.values()) {
    if (testData.status !== '準備完了') continue;
    if (isQaaMode) {
      if (!testData.isConvertibleQaa || grade === undefined) continue;
      const entries = getChoiceIndices(grade)
        .filter((choiceIndex) => hasChoiceHtml(testData, choiceIndex))
        .map((choiceIndex) => ({ no: testData.no, choiceIndex }));
      if (entries.length > 0) entriesByNo.set(testData.no, entries);
      continue;
    }

    entriesByNo.set(testData.no, [{ no: testData.no, choiceIndex: null }]);
  }

  return entriesByNo;
};

/**
 * status / workbookMode / options フィルタを適用して候補インデックスを構築する。
 * 各 CandidateEntry[] は安定順（シャッフルなし）。シャッフルは runDrawEngine 内でのみ行う。
 */
export const buildCandidateIndex = (params: {
  /** 非固定候補用。出題年フィルタ済み map を渡してよい */
  testDataByNo: ReadonlyMap<number, TestData>;
  /** 固定行メタ参照用。未指定時は testDataByNo を使う */
  allTestDataByNo?: ReadonlyMap<number, TestData>;
  /** 固定行 choice 再割り当て用。未指定時は allTestDataByNo を使う */
  fixedTestDataByNo?: ReadonlyMap<number, TestData>;
  /** qaa 系フィルタ・展開の適用判定。未指定または 'multipleChoice' ならフィルタなし */
  workbookMode?: WorkbookMode;
  /** qaa系での選択肢展開に使用。qaa系かつ未指定の場合は throw Error */
  grade?: 1 | 2;
  options: CreatePdfCommonOptionDraftState;
}): CandidateIndex => {
  const { testDataByNo, workbookMode, grade, options } = params;
  const allByNo = params.allTestDataByNo ?? testDataByNo;
  const fixedTestDataByNo = params.fixedTestDataByNo ?? allByNo;
  const excludedTagSet = new Set(options.excludedTagIds);
  const isQaaMode =
    workbookMode !== undefined && workbookMode !== 'multipleChoice';

  if (isQaaMode && grade === undefined) {
    throw new Error(
      `buildCandidateIndex: grade は qaa 系モードで必須です (workbookMode=${workbookMode})`,
    );
  }

  const bySmallCategory = new Map<string, CandidateEntry[]>();
  const byBigCategory = new Map<string, CandidateEntry[]>();
  const byDifficulty = new Map<string, CandidateEntry[]>();
  const entriesByNo = new Map<number, CandidateEntry[]>();
  const fixedEntriesByNo = buildFixedEntriesByNo({
    testDataByNo: fixedTestDataByNo,
    workbookMode,
    grade,
  });

  const pushEntry = (
    map: Map<string, CandidateEntry[]>,
    key: string,
    entry: CandidateEntry,
  ) => {
    const arr = map.get(key);
    if (arr !== undefined) {
      arr.push(entry);
    } else {
      map.set(key, [entry]);
    }
  };

  for (const d of testDataByNo.values()) {
    // status フィルタ: '準備完了' のみ対象
    if (d.status !== '準備完了') continue;

    // qaa 系フィルタ: 一問一答化不可（isConvertibleQaa === false）は除外
    if (isQaaMode && !d.isConvertibleQaa) continue;

    // タグ除外フィルタ: otherTags にいずれか1つでも excludedTagIds に一致するものがあれば除外
    if (
      excludedTagSet.size > 0 &&
      d.otherTags?.some((tag) => excludedTagSet.has(tag))
    )
      continue;

    // 過去問除外: isOriginal !== true（= 過去問）を除外
    if (options.excludePastExam && d.isOriginal !== true) continue;

    // オリジナル除外: isOriginal === true の問題を除外
    if (options.excludeOriginal && d.isOriginal === true) continue;

    const smallKey = buildSmallCategoryKey(
      d.subject,
      d.bigCategoryTag,
      d.smallCategoryTag,
    );
    const bigKey = buildBigCategoryKey(d.subject, d.bigCategoryTag);
    const diffKey = buildDifficultyKey(
      d.subject,
      d.bigCategoryTag,
      d.smallCategoryTag,
      d.difficult,
    );

    if (isQaaMode) {
      // qaa系: 有効選択肢ごとに CandidateEntry を展開
      // grade !== undefined は上の throw で保証済み
      const g = grade as 1 | 2;
      const validEntries: CandidateEntry[] = [];
      for (const i of getChoiceIndices(g)) {
        if (!hasChoiceHtml(d, i)) continue;
        if (workbookMode === 'qaaAllTrue' && !calcQaaAnswerBool(d, i)) continue;
        if (workbookMode === 'qaaAllFalse' && calcQaaAnswerBool(d, i)) continue;
        validEntries.push({ no: d.no, choiceIndex: i });
      }
      // 有効選択肢が 0 件の問題はインデックスに登録しない
      if (validEntries.length === 0) continue;

      for (const entry of validEntries) {
        pushEntry(bySmallCategory, smallKey, entry);
        pushEntry(byBigCategory, bigKey, entry);
        pushEntry(byDifficulty, diffKey, entry);
        const noArr = entriesByNo.get(d.no);
        if (noArr !== undefined) {
          noArr.push(entry);
        } else {
          entriesByNo.set(d.no, [entry]);
        }
      }
    } else {
      // multipleChoice / Exam: (no, null) を 1 件追加
      const entry: CandidateEntry = { no: d.no, choiceIndex: null };
      pushEntry(bySmallCategory, smallKey, entry);
      pushEntry(byBigCategory, bigKey, entry);
      pushEntry(byDifficulty, diffKey, entry);
      const noArr = entriesByNo.get(d.no);
      if (noArr !== undefined) {
        noArr.push(entry);
      } else {
        entriesByNo.set(d.no, [entry]);
      }
    }
  }

  return {
    bySmallCategory,
    byBigCategory,
    byDifficulty,
    allByNo,
    candidateEntriesByNo: entriesByNo,
    fixedEntriesByNo,
    byNo: allByNo,
    entriesByNo: fixedEntriesByNo,
  };
};

/**
 * OR 条件（CategoryCondition[]）にマッチする候補エントリ（重複除去済み）を返す。
 * Exam のカテゴリ OR 条件解決に使用する。
 * conditions が空の場合はその subject の全候補を返す。
 */
export const resolveCandidates = (
  index: CandidateIndex,
  subject: string,
  conditions: readonly CategoryCondition[],
): CandidateEntry[] => {
  if (conditions.length === 0) {
    // 全候補: subject が一致する全 smallKey から集める
    const prefix = `${subject}::`;
    const seen = new Set<string>();
    const result: CandidateEntry[] = [];
    for (const [key, entries] of index.bySmallCategory) {
      if (!key.startsWith(prefix)) continue;
      for (const entry of entries) {
        const k = toCandidateKey(entry.no, entry.choiceIndex);
        if (!seen.has(k)) {
          seen.add(k);
          result.push(entry);
        }
      }
    }
    return result;
  }

  const seen = new Set<string>();
  const result: CandidateEntry[] = [];
  for (const cond of conditions) {
    // small が指定されている → bySmallCategory、null → byBigCategory（big 配下全体）
    const map: ReadonlyMap<string, readonly CandidateEntry[]> =
      cond.small !== null ? index.bySmallCategory : index.byBigCategory;
    const key =
      cond.small !== null
        ? buildSmallCategoryKey(subject, cond.big, cond.small)
        : buildBigCategoryKey(subject, cond.big);

    for (const entry of map.get(key) ?? []) {
      const k = toCandidateKey(entry.no, entry.choiceIndex);
      if (!seen.has(k)) {
        seen.add(k);
        result.push(entry);
      }
    }
  }
  return result;
};

/**
 * Workbook 用: 単一 subject/big/small に対応する候補エントリを返す。
 * big が null → subject 全体、small が null → big 配下全体
 */
export const getCandidates = (
  index: CandidateIndex,
  subject: string,
  big: string | null,
  small: string | null,
): CandidateEntry[] => {
  if (big === null) {
    const prefix = `${subject}::`;
    const seen = new Set<string>();
    const result: CandidateEntry[] = [];
    for (const [key, entries] of index.bySmallCategory) {
      if (!key.startsWith(prefix)) continue;
      for (const entry of entries) {
        const k = toCandidateKey(entry.no, entry.choiceIndex);
        if (!seen.has(k)) {
          seen.add(k);
          result.push(entry);
        }
      }
    }
    return result;
  }

  if (small === null) {
    return [
      ...(index.byBigCategory.get(buildBigCategoryKey(subject, big)) ?? []),
    ];
  }

  return [
    ...(index.bySmallCategory.get(buildSmallCategoryKey(subject, big, small)) ??
      []),
  ];
};

/**
 * 自動付与タグの判定ロジック汎用 API
 * バックエンドスクリプト（testDataAutoCheckShared.cjs）と同一ロジックを持つ。
 */

import type { TestData } from '@shared/types/contracts';

// --- 公開型 ---

export type JudgeResultWithReason = {
  result: boolean;
  reasons: string[]; // result === false のとき、理由を日本語で列挙
};

export type NegativeAnswerJudge = {
  result: boolean;
  matchedWord?: string; // result === true のとき: 「誤っている」「最も不適当な」「適合しない」のいずれか
};

// --- 内部定数 ---

const QAA_ALLOWED_SUBJECT4_CATEGORIES = new Set(['各種構造', '建築材料']);
const NEGATIVE_ANSWER_PATTERN =
  /<strong>(誤っている|最も不適当な|適合しない)<\/strong>/;

// --- 内部ヘルパー ---

function hasImageOrFormula(html: string): boolean {
  if (/<img\b[^>]*>/i.test(html)) return true;
  if (/class\s*=\s*["'][^"']*\bkatex\b[^"']*["']/i.test(html)) return true;
  if (/class\s*=\s*["'][^"']*\bql-formula\b[^"']*["']/i.test(html)) return true;
  return false;
}

function hasSoutKatex(html: string): boolean {
  return /\\sout\s*\{/.test(html);
}

// 表記ブレ（noChoices → noChoice）を吸収する
function normalizeEditorType(t?: string): string | undefined {
  return t === 'noChoices' ? 'noChoice' : t;
}

function expectedChoiceCount(grade: number): number {
  return grade === 0 ? 4 : 5;
}

// HTML 文字列が「空」とみなせるか判定
function isChoiceEmpty(html: string | undefined): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return (
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, '')
      .trim().length === 0
  );
}

// --- 基本判定関数 ---

/** 選択肢シャッフル可否の判定 */
export function judgeIsShuffleable(entry: TestData): boolean {
  const q = normalizeEditorType(entry.questionEditorType);
  const a = normalizeEditorType(entry.answerEditorType);
  if (q === 'noChoice') return false;
  if (a === 'noChoice' || a === 'partialNoChoice') return false;

  const expected = expectedChoiceCount(entry.grade);
  const choiceKeys = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
  const answerKeys = [
    'answerText1',
    'answerText2',
    'answerText3',
    'answerText4',
    'answerText5',
  ] as const;

  const qCount = choiceKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;
  const aCount = answerKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;

  return qCount === expected && aCount === expected;
}

/** 一問一答化可否の判定 */
export function judgeIsConvertibleQaa(entry: TestData): boolean {
  const q = normalizeEditorType(entry.questionEditorType);
  const a = normalizeEditorType(entry.answerEditorType);
  if (q === 'noChoice') return false;
  if (a === 'noChoice' || a === 'partialNoChoice') return false;

  // 1級学科Ⅳ特例
  if (entry.grade === 0 && entry.subject === '学科Ⅳ') {
    if (!QAA_ALLOWED_SUBJECT4_CATEGORIES.has(entry.bigCategoryTag))
      return false;
  }

  if (hasImageOrFormula(entry.text ?? '')) return false;
  if (hasImageOrFormula(entry.answerText ?? '')) return false;

  const expected = expectedChoiceCount(entry.grade);
  const choiceKeys = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
  for (let i = 0; i < expected; i++) {
    if (hasSoutKatex((entry[choiceKeys[i]] as string) ?? '')) return false;
  }

  const answerKeys = [
    'answerText1',
    'answerText2',
    'answerText3',
    'answerText4',
    'answerText5',
  ] as const;
  const qCount = choiceKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;
  const aCount = answerKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;

  if (qCount === 0 || aCount === 0) return false;

  return true;
}

/** 否定問判定 */
export function judgeIsNegativeAnswer(entry: TestData): boolean {
  return NEGATIVE_ANSWER_PATTERN.test(entry.text ?? '');
}

/** 正答選択形式の判定 */
export function judgeIsPositiveAnswerForm(entry: TestData): boolean {
  return judgeIsConvertibleQaa(entry) && entry.isNegativeAnswer === false;
}

// --- 理由付き関数（UI 表示用） ---

/** シャッフル可否を理由付きで返す */
export function judgeIsShuffleableWithReason(
  entry: TestData,
): JudgeResultWithReason {
  const reasons: string[] = [];
  const q = normalizeEditorType(entry.questionEditorType);
  const a = normalizeEditorType(entry.answerEditorType);

  let qFlag = false;
  let aFlag = false;
  if (q === 'noChoice') {
    reasons.push('問題のエディタの種類が選択肢なしのため');
    qFlag = true;
  }
  if (a === 'noChoice' || a === 'partialNoChoice') {
    reasons.push('解説エディタの種類が通常または解説本文なしでないため');
    aFlag = true;
  }

  const expected = expectedChoiceCount(entry.grade);

  if (!qFlag) {
    const choiceKeys = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
    const qCount = choiceKeys
      .slice(0, expected)
      .filter((k) => !isChoiceEmpty(entry[k] as string)).length;
    if (qCount !== expected) {
      reasons.push(`問題の選択肢が${expected}つ揃っていないため`);
    }
  }
  if (!aFlag) {
    const answerKeys = [
      'answerText1',
      'answerText2',
      'answerText3',
      'answerText4',
      'answerText5',
    ] as const;
    const aCount = answerKeys
      .slice(0, expected)
      .filter((k) => !isChoiceEmpty(entry[k] as string)).length;
    if (aCount !== expected) {
      reasons.push(`解説の選択肢が${expected}つ揃っていないため`);
    }
  }

  return { result: reasons.length === 0, reasons };
}

/** 一問一答化可否を理由付きで返す */
export function judgeIsConvertibleQaaWithReason(
  entry: TestData,
): JudgeResultWithReason {
  const reasons: string[] = [];
  const q = normalizeEditorType(entry.questionEditorType);
  const a = normalizeEditorType(entry.answerEditorType);

  if (q === 'noChoice') {
    reasons.push('問題のエディタの種類が選択肢なしのため');
  }

  if (a === 'noChoice' || a === 'partialNoChoice') {
    reasons.push('解説エディタの種類が通常または解説本文なしでないため');
  }

  if (entry.grade === 0 && entry.subject === '学科Ⅳ') {
    if (!QAA_ALLOWED_SUBJECT4_CATEGORIES.has(entry.bigCategoryTag)) {
      reasons.push('1級学科Ⅳの対象外カテゴリです');
    }
  }

  if (hasImageOrFormula(entry.text ?? '')) {
    reasons.push('本文に画像または数式があります');
  }
  if (hasImageOrFormula(entry.answerText ?? '')) {
    reasons.push('解説文に画像または数式があります');
  }

  const expected = expectedChoiceCount(entry.grade);
  const choiceKeys = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
  for (let i = 0; i < expected; i++) {
    if (hasSoutKatex((entry[choiceKeys[i]] as string) ?? '')) {
      reasons.push('選択肢に打ち消し線数式があります');
      break;
    }
  }

  const answerKeys = [
    'answerText1',
    'answerText2',
    'answerText3',
    'answerText4',
    'answerText5',
  ] as const;
  const qCount = choiceKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;
  const aCount = answerKeys
    .slice(0, expected)
    .filter((k) => !isChoiceEmpty(entry[k] as string)).length;

  if (qCount === 0) {
    reasons.push('問題の選択肢が揃っていません');
  }
  if (aCount === 0) {
    reasons.push('解説の選択肢が揃っていません');
  }

  return { result: reasons.length === 0, reasons };
}

/** 否定問判定をマッチワード付きで返す */
export function judgeIsNegativeAnswerWithWord(
  entry: TestData,
): NegativeAnswerJudge {
  const match = NEGATIVE_ANSWER_PATTERN.exec(entry.text ?? '');
  if (!match) return { result: false };
  return { result: true, matchedWord: match[1] };
}

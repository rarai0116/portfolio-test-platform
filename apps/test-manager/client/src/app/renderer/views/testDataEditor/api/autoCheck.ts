/**
 * 編集データの自動チェックAPI
 * - エディタ必須項目の空判定（imgタグなし＆innerText空は空扱い）
 * - 無視ルール: grade=1→ch5/answerText5無視、answerEditorType=noHonbun→answerText無視
 *               question/answer両方のnoChoice→各選択肢(ch1..5/answerText1..5)無視
 * - META_KEYSの必須チェック
 * - editorTypeの入力チェック（questionEditorType/answerEditorType）
 * - 返却: {status, failedKeys} を主情報に、分類別の欠落も併記
 */

import type {
  answerEditorType as AnswerEditorType,
  AutoCheckResult,
  EditorKeyName,
  questionEditorType as QuestionEditorType,
  TestData,
} from '@shared/types/contracts';
import { META_KEYS } from '@shared/types/contracts';
import { PAST_EXAM_DUPLICATE_FAILED_KEY } from './pastExamDuplicate';

const TEXT_STRONG_FAILED_KEY = 'textStrong';
const ANSWER_CHOICES_ALL_EMPTY_FAILED_KEY = 'answerChoicesAllEmpty';
const ANSWER_CHOICE_KEYS: EditorKeyName[] = [
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];

const EDITOR_TO_TD_KEY: Record<EditorKeyName, keyof TestData> = {
  text: 'text',
  ch1: 'ch1',
  ch2: 'ch2',
  ch3: 'ch3',
  ch4: 'ch4',
  ch5: 'ch5',
  answerText: 'answerText',
  answerText1: 'answerText1',
  answerText2: 'answerText2',
  answerText3: 'answerText3',
  answerText4: 'answerText4',
  answerText5: 'answerText5',
};

const OPTIONAL_META_KEYS_FOR_ORIGINAL = new Set<keyof TestData>([
  'nengo',
  'year',
  'testNo',
  'publicationYear',
  'publicationNo',
  'difficult',
]);

function pickRequiredMetaKeys(entry: TestData): Array<keyof TestData> {
  return META_KEYS.filter((key) => {
    if (entry.isOriginal === true && OPTIONAL_META_KEYS_FOR_ORIGINAL.has(key)) {
      return false;
    }
    return true;
  });
}

/**
 * HTMLが「空扱い」かを厳密判定
 * 条件: <img>タグが一切無く、タグ除去後のinnerTextが空
 */
function isHtmlEmptyStrict(html: unknown): boolean {
  if (typeof html !== 'string') return true;
  const hasImg = /<img\b[^>]*>/i.test(html);
  if (hasImg) return false;
  const hasKatex =
    /class\s*=\s*["'][^"']*\bkatex\b[^"']*["']/i.test(html) ||
    /class\s*=\s*["'][^"']*\bql-formula\b[^"']*["']/i.test(html);
  if (hasKatex) return false;

  // タグ除去
  const text = html.replace(/<[^>]+>/g, ' ');
  // 最低限のエンティティをデコード
  const decoded = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim();
  return decoded.length === 0;
}

function normalizeHtmlText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[\s　]+/g, '')
    .trim();
}

function hasRequiredStrongText(html: unknown): boolean {
  if (typeof html !== 'string') return false;

  const matches = html.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi);
  for (const match of matches) {
    const content = normalizeHtmlText(match[1] ?? '');
    if (content.length >= 2) {
      return true;
    }
  }

  return false;
}

function normalizeMetaValue(key: keyof TestData, v: unknown): string | number {
  switch (key) {
    case 'grade':
      return typeof v === 'number' ? v : Number(v ?? -1);
    case 'testNo': {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? String(n) : '-1';
    }
    default:
      return String(v ?? '');
  }
}

function normalizeEditorTypes(
  q?: string,
  a?: string,
): {
  questionEditorType?: QuestionEditorType | string;
  answerEditorType?: AnswerEditorType | string;
} {
  const norm = (t?: string) => (t === 'noChoices' ? 'noChoice' : t); // 表記ブレ吸収
  return { questionEditorType: norm(q), answerEditorType: norm(a) };
}

function pickRequiredEditorKeys(params: {
  grade?: number;
  questionEditorType?: QuestionEditorType | string;
  answerEditorType?: AnswerEditorType | string;
}): { required: EditorKeyName[]; ignored: EditorKeyName[] } {
  const ignored = new Set<EditorKeyName>();

  // 級ルール: 1級ならch5/answerText5を無視
  if (params.grade === 0) {
    ignored.add('ch5');
    ignored.add('answerText5');
  }

  // question側 noChoice → ch1..5を無視
  if (params.questionEditorType === 'noChoice') {
    ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'].forEach((k) => {
      ignored.add(k as EditorKeyName);
    });
  }

  // answer側 noHonbun → answerTextを無視（解説側のみ適用）
  if (params.answerEditorType === 'noHonbun') {
    ignored.add('answerText');
  }

  // answer側 noChoice → answerText1..5を無視
  if (params.answerEditorType === 'noChoice') {
    [
      'answerText1',
      'answerText2',
      'answerText3',
      'answerText4',
      'answerText5',
    ].forEach((k) => {
      ignored.add(k as EditorKeyName);
    });
  }

  const baseRequired = new Set<EditorKeyName>();

  // question 側: 本文は常に必須、noChoice でなければ ch1〜ch5 も必須
  baseRequired.add('text');
  if (params.questionEditorType !== 'noChoice') {
    baseRequired.add('ch1');
    baseRequired.add('ch2');
    baseRequired.add('ch3');
    baseRequired.add('ch4');
    baseRequired.add('ch5');
  }

  // answer 側: noHonbun でなければ解説本文を必須
  if (
    params.answerEditorType !== 'noHonbun' &&
    params.answerEditorType !== 'partialNoChoice'
  ) {
    baseRequired.add('answerText');
  }
  // answer 側: noChoice でなければ answerText1〜5 も必須
  if (
    params.answerEditorType !== 'noChoice' &&
    params.answerEditorType !== 'partialNoChoice'
  ) {
    baseRequired.add('answerText1');
    baseRequired.add('answerText2');
    baseRequired.add('answerText3');
    baseRequired.add('answerText4');
    baseRequired.add('answerText5');
  }

  const required = Array.from(baseRequired).filter((k) => !ignored.has(k));
  return { required, ignored: Array.from(ignored) };
}

function hasAtLeastOneAnswerChoice(entry: TestData, grade?: number): boolean {
  const targetKeys =
    grade === 0 ? ANSWER_CHOICE_KEYS.slice(0, 4) : ANSWER_CHOICE_KEYS;

  return targetKeys.some((name) => {
    const tdKey = EDITOR_TO_TD_KEY[name];
    return !isHtmlEmptyStrict(entry[tdKey]);
  });
}

const HTML_EDITOR_KEY_SET = new Set<EditorKeyName>(
  Object.keys(EDITOR_TO_TD_KEY) as EditorKeyName[],
);

export type AutoCheckPreCheckReason =
  | 'force'
  | 'selectionChange'
  | 'save'
  | 'editorTypeChange'
  | 'metaChange'
  | 'htmlChange'
  | 'activeEditorChange';

type AutoCheckPreCheckParams = {
  reason: AutoCheckPreCheckReason;
  prev?: TestData;
  next?: TestData;
  changedKey?: keyof TestData;
  prevActiveEditorKey?: EditorKeyName | null;
  nextActiveEditorKey?: EditorKeyName | null;
};

function isEditorHtmlKey(
  key: keyof TestData | undefined,
): key is EditorKeyName {
  return key !== undefined && HTML_EDITOR_KEY_SET.has(key as EditorKeyName);
}

function buildAutoCheckHtmlSnapshot(entry: TestData) {
  const { questionEditorType, answerEditorType } = normalizeEditorTypes(
    entry.questionEditorType as string | undefined,
    entry.answerEditorType as string | undefined,
  );

  const grade = entry.grade as number | undefined;

  const requiredKeys = new Set(
    pickRequiredEditorKeys({
      grade,
      questionEditorType,
      answerEditorType,
    }).required,
  );

  const requiredEmptyMap = new Map<EditorKeyName, boolean>();
  for (const key of requiredKeys) {
    requiredEmptyMap.set(key, isHtmlEmptyStrict(entry[EDITOR_TO_TD_KEY[key]]));
  }

  return {
    answerEditorType,
    requiredKeys,
    requiredEmptyMap,
    textEmpty: isHtmlEmptyStrict(entry.text),
    textStrongOk: hasRequiredStrongText(entry.text),
    answerChoiceAnyFilled: hasAtLeastOneAnswerChoice(entry, grade),
  };
}

export function shouldRunAutoCheck(params: AutoCheckPreCheckParams): boolean {
  const { reason } = params;

  if (
    reason === 'force' ||
    reason === 'selectionChange' ||
    reason === 'save' ||
    reason === 'editorTypeChange' ||
    reason === 'metaChange'
  ) {
    return true;
  }

  if (reason === 'activeEditorChange') {
    return params.prevActiveEditorKey !== params.nextActiveEditorKey;
  }

  const { prev, next, changedKey } = params;
  if (!prev || !next) return true;
  if (!isEditorHtmlKey(changedKey)) return true;

  const prevSnapshot = buildAutoCheckHtmlSnapshot(prev);
  const nextSnapshot = buildAutoCheckHtmlSnapshot(next);

  const prevWasRequired = prevSnapshot.requiredKeys.has(changedKey);
  const nextIsRequired = nextSnapshot.requiredKeys.has(changedKey);

  if (prevWasRequired !== nextIsRequired) {
    return true;
  }

  if (nextIsRequired) {
    const prevEmpty = prevSnapshot.requiredEmptyMap.get(changedKey) ?? true;
    const nextEmpty = nextSnapshot.requiredEmptyMap.get(changedKey) ?? true;
    if (prevEmpty !== nextEmpty) {
      return true;
    }
  }

  if (changedKey === 'text') {
    if (prevSnapshot.textEmpty !== nextSnapshot.textEmpty) {
      return true;
    }

    if (
      !nextSnapshot.textEmpty &&
      prevSnapshot.textStrongOk !== nextSnapshot.textStrongOk
    ) {
      return true;
    }
  }

  if (ANSWER_CHOICE_KEYS.includes(changedKey)) {
    const prevNeedsAnyChoice =
      prevSnapshot.answerEditorType === 'partialNoChoice';
    const nextNeedsAnyChoice =
      nextSnapshot.answerEditorType === 'partialNoChoice';

    if (
      (prevNeedsAnyChoice || nextNeedsAnyChoice) &&
      prevSnapshot.answerChoiceAnyFilled !== nextSnapshot.answerChoiceAnyFilled
    ) {
      return true;
    }
  }

  return false;
}

export function autoCheck(
  entry: TestData,
  opts?: {
    grade?: number;
    questionEditorType?: QuestionEditorType | string;
    answerEditorType?: AnswerEditorType | string;
    duplicatePastExamIds?: string[];
  },
): AutoCheckResult {
  const { questionEditorType, answerEditorType } = normalizeEditorTypes(
    opts?.questionEditorType ??
      (entry.questionEditorType as string | undefined),
    opts?.answerEditorType ?? (entry.answerEditorType as string | undefined),
  );

  const grade =
    typeof opts?.grade === 'number' ? opts?.grade : (entry.grade as number);

  // 必須エディタキー（無視ルール適用後）
  const { required, ignored } = pickRequiredEditorKeys({
    grade,
    questionEditorType,
    answerEditorType,
  });

  console.log('Required editor keys after applying ignore rules:', required);
  // エディタ欠落判定
  const missingEditorKeys: EditorKeyName[] = [];
  for (const name of required) {
    const tdKey = EDITOR_TO_TD_KEY[name];
    const val = entry[tdKey];
    if (isHtmlEmptyStrict(val)) {
      missingEditorKeys.push(name);
    }
  }

  const failedEditorRules: string[] = [];
  if (!isHtmlEmptyStrict(entry.text) && !hasRequiredStrongText(entry.text)) {
    failedEditorRules.push(TEXT_STRONG_FAILED_KEY);
  }
  if (
    answerEditorType === 'partialNoChoice' &&
    !hasAtLeastOneAnswerChoice(entry, grade)
  ) {
    failedEditorRules.push(ANSWER_CHOICES_ALL_EMPTY_FAILED_KEY);
  }
  if ((opts?.duplicatePastExamIds?.length ?? 0) > 0) {
    failedEditorRules.push(PAST_EXAM_DUPLICATE_FAILED_KEY);
  }

  const requiredMetaKeys = pickRequiredMetaKeys(entry);

  // META欠落判定（型差吸収後の空/不正扱い）
  const missingMetaKeys: Array<keyof TestData> = [];
  for (const key of requiredMetaKeys) {
    const nv = normalizeMetaValue(key, entry[key]);
    const isEmpty =
      (typeof nv === 'string' && nv.trim().length === 0) ||
      (key === 'grade' && (typeof nv !== 'number' || !Number.isFinite(nv))) ||
      (key === 'testNo' && nv === '-1');
    if (isEmpty && key !== 'otherTags') missingMetaKeys.push(key);
  }

  // editorTypeの入力チェック（存在しない/空値）
  const missingEditorType: Array<'questionEditorType' | 'answerEditorType'> =
    [];
  if (!questionEditorType) missingEditorType.push('questionEditorType');
  if (!answerEditorType) missingEditorType.push('answerEditorType');

  // ステータス決定
  let status: AutoCheckResult['status'] = 'success';
  if (missingEditorKeys.length > 0 || failedEditorRules.length > 0) {
    status = 'error';
  } else if (missingMetaKeys.length > 0 || missingEditorType.length > 0) {
    status = 'warning';
  }

  // 失敗キー（総合）
  const failedKeys: string[] = [
    ...missingEditorKeys, // EditorKeyName
    ...failedEditorRules, // 追加ルール違反
    ...missingMetaKeys.map(String), // metaキー名
    ...missingEditorType, // editorType項目名
  ];

  return {
    status,
    failedKeys,
    missingEditorKeys,
    missingMetaKeys,
    missingEditorType,
    ignoredKeys: ignored,
    duplicatePastExamIds: opts?.duplicatePastExamIds ?? [],
  };
}

/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const META_KEYS = [
  'subject',
  'answerNumber',
  'nengo',
  'year',
  'testNo',
  'publicationYear',
  'publicationNo',
  'difficult',
  'grade',
  'bigCategoryTag',
  'smallCategoryTag',
  'themeTag',
  'otherTags',
];

const TEXT_STRONG_FAILED_KEY = 'textStrong';
const ANSWER_CHOICES_ALL_EMPTY_FAILED_KEY = 'answerChoicesAllEmpty';
const ANSWER_CHOICE_KEYS = [
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];

const EDITOR_TO_TD_KEY = {
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

const OPTIONAL_META_KEYS_FOR_ORIGINAL = new Set([
  'nengo',
  'year',
  'testNo',
  'publicationYear',
  'publicationNo',
  'difficult',
]);

function pickRequiredMetaKeys(entry) {
  return META_KEYS.filter((key) => {
    if (entry.isOriginal === true && OPTIONAL_META_KEYS_FOR_ORIGINAL.has(key)) {
      return false;
    }
    return true;
  });
}

function isHtmlEmptyStrict(html) {
  if (typeof html !== 'string') return true;
  const hasImg = /<img\b[^>]*>/i.test(html);
  if (hasImg) return false;

  const text = html.replace(/<[^>]+>/g, ' ');
  const decoded = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim();
  return decoded.length === 0;
}

function normalizeHtmlText(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[\s　]+/g, '')
    .trim();
}

function hasRequiredStrongText(html) {
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

function normalizeMetaValue(key, value) {
  switch (key) {
    case 'grade': {
      return typeof value === 'number' ? value : Number(value ?? -1);
    }

    case 'testNo': {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) && numberValue > 0
        ? String(numberValue)
        : '-1';
    }

    default: {
      return String(value ?? '');
    }
  }
}

function normalizeEditorTypes(questionEditorType, answerEditorType) {
  const normalize = (editorType) =>
    editorType === 'noChoices' ? 'noChoice' : editorType;

  return {
    questionEditorType: normalize(questionEditorType),
    answerEditorType: normalize(answerEditorType),
  };
}

function pickRequiredEditorKeys(params) {
  const ignored = new Set();

  // frontend 実装に合わせる: grade===0 では ch5 / answerText5 を無視する
  if (params.grade === 0) {
    ignored.add('ch5');
    ignored.add('answerText5');
  }

  if (params.questionEditorType === 'noChoice') {
    ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'].forEach((key) => {
      ignored.add(key);
    });
  }

  if (params.answerEditorType === 'noHonbun') {
    ignored.add('answerText');
  }

  if (params.answerEditorType === 'noChoice') {
    [
      'answerText1',
      'answerText2',
      'answerText3',
      'answerText4',
      'answerText5',
    ].forEach((key) => {
      ignored.add(key);
    });
  }

  const baseRequired = new Set();
  baseRequired.add('text');

  if (params.questionEditorType !== 'noChoice') {
    baseRequired.add('ch1');
    baseRequired.add('ch2');
    baseRequired.add('ch3');
    baseRequired.add('ch4');
    baseRequired.add('ch5');
  }

  if (params.answerEditorType !== 'noHonbun') {
    baseRequired.add('answerText');
  }

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

  const required = [...baseRequired].filter((key) => !ignored.has(key));

  return {
    required,
    ignored: [...ignored],
  };
}

function hasAtLeastOneAnswerChoice(entry, grade) {
  const targetKeys = grade === 0 ? ANSWER_CHOICE_KEYS.slice(0, 4) : ANSWER_CHOICE_KEYS;

  return targetKeys.some((name) => {
    const tdKey = EDITOR_TO_TD_KEY[name];
    return !isHtmlEmptyStrict(entry[tdKey]);
  });
}

function runAutoCheckForScript(entry, options = {}) {
  const normalizedEditorTypes = normalizeEditorTypes(
    options.questionEditorType ?? entry.questionEditorType,
    options.answerEditorType ?? entry.answerEditorType,
  );

  const grade =
    typeof options.grade === 'number' ? options.grade : Number(entry.grade);

  const { required, ignored } = pickRequiredEditorKeys({
    grade,
    questionEditorType: normalizedEditorTypes.questionEditorType,
    answerEditorType: normalizedEditorTypes.answerEditorType,
  });

  const missingEditorKeys = [];
  for (const name of required) {
    const tdKey = EDITOR_TO_TD_KEY[name];
    const value = entry[tdKey];
    if (isHtmlEmptyStrict(value)) {
      missingEditorKeys.push(name);
    }
  }

  const failedEditorRules = [];
  if (!isHtmlEmptyStrict(entry.text) && !hasRequiredStrongText(entry.text)) {
    failedEditorRules.push(TEXT_STRONG_FAILED_KEY);
  }
  if (
    normalizedEditorTypes.answerEditorType === 'partialNoChoice' &&
    !hasAtLeastOneAnswerChoice(entry, grade)
  ) {
    failedEditorRules.push(ANSWER_CHOICES_ALL_EMPTY_FAILED_KEY);
  }

  const requiredMetaKeys = pickRequiredMetaKeys(entry);
  const missingMetaKeys = [];
  for (const key of requiredMetaKeys) {
    const normalizedValue = normalizeMetaValue(key, entry[key]);
    const isEmpty =
      (typeof normalizedValue === 'string' && normalizedValue.trim().length === 0) ||
      (key === 'grade' &&
        (typeof normalizedValue !== 'number' || !Number.isFinite(normalizedValue))) ||
      (key === 'testNo' && normalizedValue === '-1');

    if (isEmpty && key !== 'otherTags') {
      missingMetaKeys.push(key);
    }
  }

  const missingEditorType = [];
  if (!normalizedEditorTypes.questionEditorType) {
    missingEditorType.push('questionEditorType');
  }
  if (!normalizedEditorTypes.answerEditorType) {
    missingEditorType.push('answerEditorType');
  }

  let status = 'success';
  if (missingEditorKeys.length > 0 || failedEditorRules.length > 0) {
    status = 'error';
  } else if (missingMetaKeys.length > 0 || missingEditorType.length > 0) {
    status = 'warning';
  }

  return {
    status,
    autoCheckOk: status === 'success',
    failedKeys: [
      ...missingEditorKeys,
      ...failedEditorRules,
      ...missingMetaKeys.map(String),
      ...missingEditorType,
    ],
    missingEditorKeys,
    missingMetaKeys,
    missingEditorType,
    ignoredKeys: ignored,
  };
}

// --- 選択肢シャッフル・一問一答・否定問 判定関数 ---

const QAA_ALLOWED_SUBJECT4_CATEGORIES = new Set(['各種構造', '建築材料']);
// 否定問パターン: <strong> で囲まれた否定語
const NEGATIVE_ANSWER_PATTERN = /<strong>(誤っている|最も不適当な|適合しない)<\/strong>/;

/** HTML に画像または KaTeX 数式が含まれるか判定する */
function hasImageOrFormula(html) {
  if (typeof html !== 'string') return false;
  if (/<img\b[^>]*>/i.test(html)) return true;
  if (/class\s*=\s*["'][^"']*\bkatex\b[^"']*["']/i.test(html)) return true;
  if (/class\s*=\s*["'][^"']*\bql-formula\b[^"']*["']/i.test(html)) return true;
  return false;
}

/** HTML に KaTeX の \sout{} が含まれるか判定する */
function hasSoutKatex(html) {
  if (typeof html !== 'string') return false;
  return /\\sout\s*\{/.test(html);
}

/** grade に応じた問題側選択肢フィールドキーを返す（grade=0: ch1〜ch4, grade=1: ch1〜ch5） */
function getQuestionChoiceKeys(grade) {
  return grade === 0
    ? ['ch1', 'ch2', 'ch3', 'ch4']
    : ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'];
}

/** grade に応じた解説側選択肢フィールドキーを返す（grade=0: answerText1〜4, grade=1: answerText1〜5） */
function getAnswerTextChoiceKeys(grade) {
  return grade === 0
    ? ['answerText1', 'answerText2', 'answerText3', 'answerText4']
    : ['answerText1', 'answerText2', 'answerText3', 'answerText4', 'answerText5'];
}

/**
 * 一問一答への変換可否を返す。
 * 「選択肢あり・画像/数式なし・\sout{}なし・有効選択肢が問/解説ともに1件以上」が条件。
 * grade=0 の学科Ⅳは許可カテゴリ（各種構造・建築材料）のみ true。
 */
function judgeIsConvertibleQaa(entry) {
  const grade = typeof entry.grade === 'number' ? entry.grade : Number(entry.grade);
  // 'noChoices' は正規化済み 'noChoice' と等価に扱う
  const qType = entry.questionEditorType === 'noChoices' ? 'noChoice' : entry.questionEditorType;
  const aType = entry.answerEditorType === 'noChoices' ? 'noChoice' : entry.answerEditorType;

  if (qType === 'noChoice' || aType === 'noChoice' || aType === 'partialNoChoice') return false;

  // 1級（grade=0）の学科Ⅳは許可カテゴリのみ対象
  if (grade === 0 && entry.subject === '学科Ⅳ') {
    if (!QAA_ALLOWED_SUBJECT4_CATEGORIES.has(entry.bigCategoryTag)) return false;
  }

  if (hasImageOrFormula(entry.text ?? '')) return false;
  if (hasImageOrFormula(entry.answerText ?? '')) return false;

  const qKeys = getQuestionChoiceKeys(grade);
  for (const key of qKeys) {
    if (hasSoutKatex(entry[key] ?? '')) return false;
  }

  // 問題側・解説側ともに有効選択肢が 1 件以上必要
  if (qKeys.filter((k) => !isHtmlEmptyStrict(entry[k])).length < 1) return false;
  const aKeys = getAnswerTextChoiceKeys(grade);
  if (aKeys.filter((k) => !isHtmlEmptyStrict(entry[k])).length < 1) return false;

  return true;
}

/**
 * 選択肢シャッフル可否を返す。
 * 「選択肢あり・問題側・解説側ともに grade 規定の全選択肢が揃っている」が条件。
 */
function judgeIsShuffleable(entry) {
  const grade = typeof entry.grade === 'number' ? entry.grade : Number(entry.grade);
  const qType = entry.questionEditorType === 'noChoices' ? 'noChoice' : entry.questionEditorType;
  const aType = entry.answerEditorType === 'noChoices' ? 'noChoice' : entry.answerEditorType;

  if (qType === 'noChoice' || aType === 'noChoice' || aType === 'partialNoChoice') return false;

  // 全選択肢が揃っていること（欠落不可）
  const qKeys = getQuestionChoiceKeys(grade);
  if (qKeys.filter((k) => !isHtmlEmptyStrict(entry[k])).length !== qKeys.length) return false;

  const aKeys = getAnswerTextChoiceKeys(grade);
  if (aKeys.filter((k) => !isHtmlEmptyStrict(entry[k])).length !== aKeys.length) return false;

  return true;
}

/** 問題文に否定問パターンが含まれるか判定する */
function judgeIsNegativeAnswer(entry) {
  return NEGATIVE_ANSWER_PATTERN.test(entry.text ?? '');
}

/**
 * 肯定問の選択式かどうかを返す。
 * 一問一答化可能 かつ isNegativeAnswer=false の場合のみ true。
 */
function judgeIsPositiveAnswerForm(entry) {
  return judgeIsConvertibleQaa(entry) && entry.isNegativeAnswer === false;
}

module.exports = {
  runAutoCheckForScript,
  hasImageOrFormula,
  hasSoutKatex,
  judgeIsConvertibleQaa,
  judgeIsShuffleable,
  judgeIsNegativeAnswer,
  judgeIsPositiveAnswerForm,
};
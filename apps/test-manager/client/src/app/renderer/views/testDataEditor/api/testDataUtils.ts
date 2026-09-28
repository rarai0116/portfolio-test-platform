import {
  type SanitizerBoundary,
  sanitizeEditorRuntimeHtml,
  sanitizePersistedHtml,
} from '@api/htmlSanitizer';
import { compactFormulaHtmlForStorage } from '@api/quillUtils';
import { parseImgTagAttributes } from '@api/utils';
import type { TestData, TestDataStatus } from '@shared/types/contracts';

const QUESTION_HTML_FIELDS: Array<keyof TestData> = [
  'text',
  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
];
const ANSWER_HTML_FIELDS: Array<keyof TestData> = [
  'answerText',
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];

const IMG_TAG_RE = /<img\b[^>]*>/gi;

// Quillで編集対象となるHTMLフィールド一覧
export const HTML_FIELDS: Array<keyof TestData> = [
  ...QUESTION_HTML_FIELDS,
  ...ANSWER_HTML_FIELDS,
];
export const HTML_FIELD_SET: ReadonlySet<keyof TestData> = new Set(HTML_FIELDS);

// src をスキーム非依存で除去し（data: も demo-asset: も残さない）、alt などの属性は維持して再構築する
export function stripEmbeddedImagesFromHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  IMG_TAG_RE.lastIndex = 0;
  const rebuilt = html.replace(IMG_TAG_RE, (tag) => {
    const attrs = parseImgTagAttributes(tag);
    if (!attrs) return tag;

    // もとの属性から src を除外し、alt/width/height などは維持
    const { src: _omit, ...rest } = attrs;

    const stableKeys = [
      'alt',
      'width',
      'height',
      'style',
      // 以下は任意の残存属性
      ...Object.keys(rest).filter(
        (k) => !['alt', 'width', 'height', 'style'].includes(k),
      ),
    ];

    const attrString = stableKeys
      .filter((k) => rest[k] !== undefined && rest[k] !== false)
      .map((k) => {
        const v = rest[k];
        // boolean 属性は key のみ、それ以外は "..." で囲む
        if (v === true) return `${k}`;
        return `${k}="${String(v)}"`;
      })
      .join(' ')
      .trim();

    return attrString ? `<img ${attrString} />` : '<img />';
  });

  return rebuilt;
}

export function compactFormulaHtmlInTestData(src: TestData): TestData {
  const next: TestData = { ...src };
  HTML_FIELDS.forEach((k) => {
    const v = src[k];
    if (typeof v === 'string') {
      next[k] = compactFormulaHtmlForStorage(v);
    }
  });
  return next;
}

// TestData の該当HTMLフィールドに対して strip を適用
export function stripEmbeddedImagesFromTestData(src: TestData): TestData {
  const next: TestData = { ...src };
  HTML_FIELDS.forEach((k) => {
    const v = src[k];
    if (typeof v === 'string') {
      next[k] = applyCommonRulesToHtml(v, { fieldName: String(k) });
    }
  });
  return next;
}

export function applyCommonRulesToHtml(
  html: string,
  context?: {
    boundary?: Extract<SanitizerBoundary, 'load' | 'save'>;
    itemId?: string;
    fieldName?: string;
  },
): string {
  return sanitizePersistedHtml(html, {
    boundary: context?.boundary ?? 'save',
    itemId: context?.itemId,
    fieldName: context?.fieldName,
  }).sanitizedHtml;
}

export function applyEditorRuntimeRulesToHtml(
  html: string,
  context?: {
    itemId?: string;
    fieldName?: string;
  },
): string {
  return sanitizeEditorRuntimeHtml(html, {
    itemId: context?.itemId,
    fieldName: context?.fieldName,
  }).sanitizedHtml;
}

export function normalizeEditorTypesInTestData(
  src: TestData,
): [TestData, boolean] {
  // エディタタイプが未設定の場合、条件に応じてEditorTypeを設定
  let isChanged = false;
  if (!src.questionEditorType) {
    isChanged = true;
    // 選択肢が全て空か<p><br></p>の場合は、選択肢なしに設定
    const isNoChoice = QUESTION_HTML_FIELDS.every((key) => {
      if (key === 'text') return true; // 問題文は選択肢なし判定に含めない
      return (
        src[key] === '' ||
        src[key] === '<p><br></p>' ||
        src[key] === '<p>　</p>' ||
        src[key] === null
      );
    });
    if (isNoChoice) {
      src.questionEditorType = 'noChoice';
    } else {
      src.questionEditorType = 'normal';
    }
  }

  if (!src.answerEditorType) {
    isChanged = true;
    const isNoAnswer = ANSWER_HTML_FIELDS.every((key) => {
      if (key === 'answerText') return true;
      return (
        src[key] === '' ||
        src[key] === '<p><br></p>' ||
        src[key] === '<p>　</p>' ||
        src[key] === null
      );
    });
    const isNoHonbun =
      src.answerText === '' ||
      src.answerText === '<p><br></p>' ||
      src.answerText === '<p>　</p>' ||
      src.answerText === null;
    if (isNoAnswer) {
      if (isNoHonbun) {
        // どちらもなしならnormalに
        src.answerEditorType = 'normal';
      } else {
        src.answerEditorType = 'noChoice';
      }
    } else if (isNoHonbun) {
      src.answerEditorType = 'noHonbun';
    } else {
      src.answerEditorType = 'normal';
    }
  }
  return [src, isChanged];
}

export function applyCommonRulesToTestData(
  src: TestData,
  context?: {
    boundary?: Extract<SanitizerBoundary, 'load' | 'save'>;
    itemId?: string;
  },
): TestData {
  const next: TestData = { ...src };
  HTML_FIELDS.forEach((k) => {
    const v = src[k];
    if (typeof v === 'string') {
      next[k] = applyCommonRulesToHtml(v, {
        boundary: context?.boundary,
        itemId: context?.itemId,
        fieldName: String(k),
      });
    }
  });
  return next;
}

/**
 * 自動状態導出（仕様書準拠・手動停止を尊重）
 * - 停止中は手動解除まで固定（自動では切り替えない）
 * - それ以外は autoCheck=false ならエラー
 * - autoCheck=true の場合のみ calibrationCheck で準備完了/準備中
 */
const deriveActiveTestDataStatus = (args: {
  autoCheckOk: boolean;
  calibrationCheck: boolean;
}): TestDataStatus => {
  if (!args.autoCheckOk) return 'エラー';
  return args.calibrationCheck ? '準備完了' : '準備中';
};

export function deriveTestDataStatus(args: {
  currentStatus: string | undefined;
  autoCheckOk: boolean;
  calibrationCheck: boolean;
}): TestDataStatus {
  if (args.currentStatus === '停止中') return '停止中';
  return deriveActiveTestDataStatus(args);
}

export function deriveTestDataStatusAfterResume(args: {
  autoCheckOk: boolean;
  calibrationCheck: boolean;
}): TestDataStatus {
  return deriveActiveTestDataStatus(args);
}

// usedIdKey → { gradeNo, docId } に分解するユーティリティ
export function parseUsedIdKey(
  key: string,
): { gradeNo: '0' | '1'; docId: string } | null {
  const m = key.match(/^([01])_(.+)$/);
  if (!m) return null;
  return { gradeNo: m[1] as '0' | '1', docId: m[2] };
}

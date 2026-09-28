import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type UidOptions = {
  prefix?: string;
  suffix?: string;
};

export const createUid = (baseId: string, options?: UidOptions): string => {
  const { prefix = '', suffix = '' } = options || {};
  return `${prefix}_${baseId}_${suffix}`;
};

export type ImgAttrMap = Record<string, string | boolean>;

/**
 * 単一の img タグ文字列から属性名と値を抽出して返す。
 * - 値は "..." / '...' / 未引用 に対応
 * - 値が未指定の属性は true（ブール属性）を割り当て
 * - 基本的な HTML エンティティ (&amp; 等) をデコード
 * - img タグでない場合は null を返す
 */
export function parseImgTagAttributes(tag: string): ImgAttrMap | null {
  if (typeof tag !== 'string') return null;

  // <img ...> の属性部分を抽出
  const m = /<img\b([^>]*)>/i.exec(tag);
  if (!m) return null;
  const attrs = m[1];

  const result: ImgAttrMap = {};

  // 属性名 + 任意の値（"..." / '...' / 非引用 / 値なし）
  const attrRe =
    /\b([^\s"'=<>/]+)\s*(=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null = attrRe.exec(attrs);
  while (match !== null) {
    const name = match[1];

    // 値ありなら 3|4|5 のいずれか、値なしならブール属性として true
    let value: string | boolean;
    if (match[2]) {
      value = match[3] ?? match[4] ?? match[5] ?? '';
      value = decodeHtmlEntities(String(value));
    } else {
      value = true;
    }

    if (value !== '') result[name] = value;
    match = attrRe.exec(attrs);
  }

  return result;
}

const imgTagRe = /<img\b[^>]*>/gi;

export const extractImageIdsFromHtml = (html: string | undefined) => {
  if (!html || typeof html !== 'string') return [];
  const ids = new Set<string>();

  // alt属性の抽出（"..." / '...' / 非クォート値のいずれにも対応）
  const altAttrRe = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

  // グローバル正規表現の検索位置を毎回リセット
  imgTagRe.lastIndex = 0;

  let match: RegExpExecArray | null;
  do {
    match = imgTagRe.exec(html);
    if (match === null) break;
    const tag = match[0];
    const alt = altAttrRe.exec(tag);
    const val = (alt?.[1] ?? alt?.[2] ?? alt?.[3] ?? '').trim();
    if (val) ids.add(val);
  } while (match !== null);

  return Array.from(ids);
};

function decodeHtmlEntities(s: string): string {
  if (!s?.includes('&')) return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

type TimestampLike =
  | { toDate: () => Date } // Firestore Timestamp
  | { seconds: number; nanoseconds: number }; // plain object

export const toIsoFromTimestampLike = (
  value: TimestampLike | undefined,
): string | undefined => {
  if (!value) return undefined;

  // Firestore Timestamp
  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  // Serialized timestamp object
  if ('seconds' in value && 'nanoseconds' in value) {
    const millis = value.seconds * 1000 + value.nanoseconds / 1_000_000;
    return new Date(millis).toISOString();
  }

  return undefined;
};

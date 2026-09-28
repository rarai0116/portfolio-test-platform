import type { TestData } from '@shared/types/contracts';

/** 元号の新しい順の重み（認識できない元号は最古扱い） */
const NENGO_WEIGHT: Record<string, number> = {
  令和: 2,
  平成: 1,
};

/** 元号→西暦元年（元年=base+1） */
const NENGO_BASE: Record<string, number> = {
  令和: 2018,
  平成: 1988,
};

/**
 * "令和6" → "令和6（2024）"、"令和1" → "令和元（2019）" のように西暦を併記する。
 * 認識できない元号やパース失敗時は元のラベルを返す。
 */
export function formatYearLabelWithSeireki(label: string): string {
  for (const [nengo, base] of Object.entries(NENGO_BASE)) {
    if (!label.startsWith(nengo)) continue;
    const yearNum = parseInt(label.slice(nengo.length), 10);
    if (Number.isNaN(yearNum)) return label;
    const seireki = base + yearNum;
    const yearStr = yearNum === 1 ? '元' : String(yearNum);
    return `${nengo}${yearStr} (${seireki})`;
  }
  return label;
}

function sortKey(label: string): number {
  // ラベル形式 "元号N年" → 元号部分と年数値に分解
  for (const [nengo, weight] of Object.entries(NENGO_WEIGHT)) {
    if (label.startsWith(nengo)) {
      const yearNum = parseInt(label.slice(nengo.length), 10);
      return weight * 10000 + (Number.isNaN(yearNum) ? 0 : yearNum);
    }
  }
  return 0;
}

/**
 * 出題年ラベルを新しい順（降順）にソートして返す。
 * 元号重み × 年度数値でソートする。認識できない元号は最も古いとみなす。
 */
export function sortYearLabelsDesc(labels: string[]): string[] {
  return [...labels].sort((a, b) => sortKey(b) - sortKey(a));
}

/**
 * testDataByNo から label → nos の ReadonlyMap を構築する。
 * nengo または year が空文字・null の TestData は除外する（オリジナル問題等）。
 */
export function buildNosMapFromTestData(
  testDataByNo: ReadonlyMap<number, TestData>,
): ReadonlyMap<string, readonly number[]> {
  const map = new Map<string, number[]>();
  for (const [no, data] of testDataByNo) {
    if (!data.nengo || !data.year) continue;
    const label = `${data.nengo}${data.year}`;
    const list = map.get(label) ?? [];
    list.push(no);
    map.set(label, list);
  }
  return map;
}

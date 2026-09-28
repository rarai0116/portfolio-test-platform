import seedrandom from 'seedrandom';

/**
 * 選択肢シャッフル用のシード値を新規生成する。
 * 符号なし 31bit 整数（0 〜 2^31-1）を返す。
 * 0 はシャッフル無効を示す特殊値として使用されているため、0 は生成しない。
 */
export const generateShuffleSeed = (): number =>
  Math.floor(Math.random() * (2 ** 31 - 1)) + 1;

/**
 * グローバル shuffleSeed と item の id を組み合わせた、
 * per-item シード文字列を生成する。
 * 同一 shuffleSeed・同一 id では常に同じ文字列を返す。
 */
export const buildItemSeedStr = (shuffleSeed: number, itemId: string): string =>
  `${shuffleSeed}-${itemId}`;

/**
 * Fisher-Yates シャッフル（seedrandom ベース）。
 * 同一 seedStr に対して常に同じ順序を返す（決定的）。
 *
 * @returns shuffled  シャッフル後の配列
 * @returns permutation  permutation[k] = 元の index（shuffled[k] は arr[permutation[k]]）
 */
export const shuffleWithSeed = <T>(
  arr: T[],
  seedStr: string,
): { shuffled: T[]; permutation: number[] } => {
  const rng = seedrandom(seedStr);
  const permutation = arr.map((_, i) => i);
  for (let i = permutation.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = permutation[i];
    permutation[i] = permutation[j] as number;
    permutation[j] = tmp as number;
  }
  return {
    shuffled: permutation.map((origIdx) => arr[origIdx] as T),
    permutation,
  };
};

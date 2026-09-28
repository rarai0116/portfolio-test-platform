/** 不正なサイズを「ダウンロード不要」と判断しない。 */
export const getDownloadTotalSize = (...sizes: number[]) => {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (
    sizes.some((size) => !Number.isFinite(size) || size < 0) ||
    !Number.isFinite(total)
  ) {
    throw new Error('ダウンロードサイズが不正です');
  }
  return total;
};

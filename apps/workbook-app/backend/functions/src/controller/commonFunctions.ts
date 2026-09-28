export const chunk = <T extends any[]>(array: T, size: number): T[] =>
  array.reduce(
    (newarr, _, i) =>
      i % size ? newarr : [...newarr, array.slice(i, i + size)],
    [],
  );

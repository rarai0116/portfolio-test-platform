export const removeArrayElement: <T>(target: T, arr: T[]) => T[] = (
  target,
  arr,
) => {
  return arr.filter((item) => item !== target);
};

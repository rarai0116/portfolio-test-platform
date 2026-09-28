/** カレンダーは年月日を端末内のDateで表す。瞬間の日本時間変換とは分ける。 */
const firstOfMonth = (year: number, month: number) => {
  const date = new Date(year, month - 1, 1);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(date.getTime())
  ) {
    throw new Error('カレンダーの年月が不正です');
  }
  return date;
};

export const getCalendarMonthWeekStarts = (year: number, month: number) => {
  const sundayOffset = 1 - firstOfMonth(year, month).getDay();
  return Array.from(
    {length: 6},
    (_, index) => new Date(year, month - 1, sundayOffset + index * 7),
  );
};

export const getCalendarDateAtPosition = (
  year: number,
  month: number,
  row: number,
  column: number,
) => {
  const offset = row * 7 + column - firstOfMonth(year, month).getDay();
  return new Date(year, month - 1, offset + 1);
};

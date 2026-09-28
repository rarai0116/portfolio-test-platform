import {getCalendarMonthWeekStarts, getCalendarDateAtPosition} from '../../components/functionals/calendarDates';
import {getDateToYmdString} from '../../components/functionals/timeManager';
const ymd = (date: Date) => getDateToYmdString(date, 'hyphen');

it('aligns six calendar weeks on Sunday independently of the device timezone', () => {
  const dates = getCalendarMonthWeekStarts(2026, 9);
  expect(dates.map(ymd)).toEqual(['2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04']);
  expect(dates.every((date) => date.getDay() === 0 && Number.isFinite(date.getTime()))).toBe(true);
});

it('maps pressed cells to the same dates, including leap day and adjacent months', () => {
  expect(ymd(getCalendarDateAtPosition(2026, 9, 0, 0))).toBe('2026-08-30');
  expect(ymd(getCalendarDateAtPosition(2026, 9, 0, 2))).toBe('2026-09-01');
  expect(ymd(getCalendarDateAtPosition(2024, 2, 4, 4))).toBe('2024-02-29');
  expect(ymd(getCalendarDateAtPosition(2026, 9, 5, 6))).toBe('2026-10-10');
});

it('rejects invalid calendar inputs instead of publishing invalid dates', () => {
  expect(() => getCalendarMonthWeekStarts(NaN, 9)).toThrow('年月が不正');
  expect(() => getCalendarMonthWeekStarts(2026, 13)).toThrow('年月が不正');
});

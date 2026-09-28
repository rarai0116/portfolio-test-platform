import {Timestamp} from '@react-native-firebase/firestore';
import {
  currentYear, currentMonth, currentDate, now,
  getTodayTimestamp, getMilliseconds, getYmdhmsmString, getYmString,
  getYmdString, getMdString, getTimeString, getDayOfWeekString,
  getMdwString, getYmdDayString, getYmdDayTimeString,
  getDatesBetween, getDatesBetweenString, getDateToYmdString,
  getJapanDayBoundary, timeUnitConverter,
} from '../../components/functionals/timeManager';
import {getJapanTime} from '../../components/functionals/japanTime';

it('really starts in the requested timezone (each zone runs in a separate process)', () => {
  const offsets: Record<string, number> = {UTC: 0, 'Asia/Tokyo': -540, 'America/New_York': 300, 'Europe/Paris': -60, 'Pacific/Kiritimati': -840};
  if (process.env.TZ && process.env.TZ in offsets) {
    expect(new Date('2026-01-01T00:00:00Z').getTimezoneOffset()).toBe(offsets[process.env.TZ]);
  }
});

it('formats all Timestamp date/time representations in Japan time', () => {
  const stamp = Timestamp.fromDate(new Date('2025-12-31T15:30:45Z'));
  expect(getYmString(stamp)).toBe('202601');
  expect(getYmdString(stamp, 'hyphen')).toBe('2026-01-01');
  expect(getYmdString(stamp, 'slash')).toBe('2026/01/01');
  expect(getYmdString(stamp, 'kanji')).toBe('2026年01月01日');
  expect(getYmdString(stamp, 'none')).toBe('20260101');
  expect(getYmdhmsmString(stamp)).toBe('20260101003045000');
  expect(getMdString(stamp)).toBe('01/01');
  expect(getTimeString(stamp)).toBe('00:30');
  expect(getDayOfWeekString(stamp)).toBe('木');
  expect(getMdwString(stamp)).toBe('01月01日(木)');
  expect(getYmdDayString(stamp)).toBe('2026/01/01(木)');
  expect(getYmdDayTimeString(stamp)).toBe('2026/01/01(木)00:30');
  expect(Number.isFinite(getMilliseconds(stamp))).toBe(true);
});

it('keeps current date constants finite and consistent with their Japan timestamp', () => {
  const japan = getJapanTime(now.toDate());
  expect([currentYear, currentMonth, currentDate]).toEqual([japan.year(), japan.month() + 1, japan.date()]);
  for (const value of [currentYear, currentMonth, currentDate, getTodayTimestamp().toDate().getTime()]) {
    expect(Number.isFinite(value)).toBe(true);
  }
});

it('enumerates leap days and returns valid local calendar date markers', () => {
  const start = Timestamp.fromDate(new Date('2024-02-28T00:00:00+09:00'));
  const end = Timestamp.fromDate(new Date('2024-03-01T23:59:59+09:00'));
  expect(getDatesBetweenString(start, end, 'kanji')).toEqual(['2024年02月28日', '2024年02月29日', '2024年03月01日']);
  const dates = getDatesBetween(start, end);
  expect(dates.map((date) => getDateToYmdString(date, 'hyphen'))).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  expect(dates.every((date) => Number.isFinite(date.getTime()))).toBe(true);
});

it('preserves a selected local calendar day when saving Japan day boundaries', () => {
  const selected = new Date(2026, 0, 1);
  expect(getJapanDayBoundary(selected, 'start').toISOString()).toBe('2025-12-31T15:00:00.000Z');
  expect(getJapanDayBoundary(selected, 'end').toISOString()).toBe('2026-01-01T14:59:59.999Z');
});

it('returns an empty range for reversed days and does not emit NaN for valid durations', () => {
  const start = Timestamp.fromDate(new Date('2026-01-02T00:00:00+09:00'));
  const end = Timestamp.fromDate(new Date('2026-01-01T00:00:00+09:00'));
  expect(getDatesBetweenString(start, end, 'hyphen')).toEqual([]);
  for (const duration of [0, 1000, 60000, 3600000, 86400000]) {
    expect(timeUnitConverter(duration)).not.toMatch(/NaN|Invalid/);
  }
});

it('rejects invalid inputs before helpers can return NaN or invalid date strings', () => {
  const invalid = Timestamp.fromDate(new Date(NaN));
  expect(() => getMilliseconds(invalid)).toThrow('日付が不正');
  expect(() => getYmdString(invalid, 'none')).toThrow('日付が不正');
  expect(() => getDateToYmdString(new Date(NaN), 'hyphen')).toThrow('日付が不正');
  for (const duration of [NaN, Infinity, -1]) {
    expect(() => timeUnitConverter(duration)).toThrow('所要時間が不正');
  }
});

it('preserves the selected calendar range even on a device at UTC+14', () => {
  const selectedStart = new Date(2026, 0, 1);
  const selectedEnd = new Date(2026, 0, 3);
  const start = Timestamp.fromDate(getJapanDayBoundary(selectedStart, 'start'));
  const end = Timestamp.fromDate(getJapanDayBoundary(selectedEnd, 'end'));
  expect(getDatesBetween(start, end).map((date) => getDateToYmdString(date, 'hyphen'))).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
});

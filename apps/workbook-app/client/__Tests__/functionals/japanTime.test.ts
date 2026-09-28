import {Timestamp} from '@react-native-firebase/firestore';
import {getJapanTime} from '../../components/functionals/japanTime';
import {getDatesBetweenString} from '../../components/functionals/timeManager';
import {getDownloadTotalSize} from '../../components/functionals/downloadSize';

it('converts an instant to Japan time across the year boundary without locale parsing', () => {
  const spy = jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
    throw new Error('Hermes cannot parse this locale string');
  });
  try {
    const japan = getJapanTime(new Date('2025-12-31T15:00:00Z'));
    expect(japan.year()).toBe(2026);
    expect(japan.format('YYYYMMDD HH:mm')).toBe('20260101 00:00');
    expect(japan.toDate().toISOString()).toBe('2025-12-31T15:00:00.000Z');
    expect(japan.utcOffset()).toBe(540);
    expect(spy).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});

it('includes every Japan calendar day without applying the offset twice', () => {
  const start = Timestamp.fromDate(new Date('2025-12-31T23:30:00+09:00'));
  const end = Timestamp.fromDate(new Date('2026-01-02T00:30:00+09:00'));
  expect(getDatesBetweenString(start, end, 'none')).toEqual(['20251231', '20260101', '20260102']);
  expect(getDatesBetweenString(start, end, 'hyphen')).toEqual(['2025-12-31', '2026-01-01', '2026-01-02']);
});

it('keeps consecutive dates through the host daylight saving transition', () => {
  const start = Timestamp.fromDate(new Date('2026-03-07T00:00:00+09:00'));
  const end = Timestamp.fromDate(new Date('2026-03-10T23:59:59+09:00'));
  expect(getDatesBetweenString(start, end, 'slash')).toEqual(['2026/03/07', '2026/03/08', '2026/03/09', '2026/03/10']);
});

it('rejects invalid dates instead of propagating NaN', () => {
  expect(() => getJapanTime(new Date(NaN))).toThrow('日付が不正');
});

it('rejects invalid download sizes instead of marking missing assets complete', () => {
  expect(getDownloadTotalSize(244987016, 2912000)).toBe(247899016);
  expect(getDownloadTotalSize(0, 0)).toBe(0);
  for (const size of [NaN, Infinity, -1]) {
    expect(() => getDownloadTotalSize(244987016, size)).toThrow('サイズが不正');
  }
});

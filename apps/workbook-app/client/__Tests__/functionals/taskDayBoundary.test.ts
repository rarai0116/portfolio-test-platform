import {getJapanDayBoundary} from '../../components/functionals/timeManager';

it('creates the selected day boundaries in Japan time without locale string parsing', () => {
  const selected = new Date(2026, 8, 17);
  const locale = jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
    throw new Error('Locale string parsing must not be used');
  });
  try {
    expect(getJapanDayBoundary(selected, 'start').toISOString()).toBe('2026-09-16T15:00:00.000Z');
    expect(getJapanDayBoundary(selected, 'end').toISOString()).toBe('2026-09-17T14:59:59.999Z');
    expect(locale).not.toHaveBeenCalled();
  } finally {
    locale.mockRestore();
  }
});

it('preserves the selected calendar day at a month boundary', () => {
  const selected = new Date(2026, 0, 1);
  expect(getJapanDayBoundary(selected, 'start').toISOString()).toBe('2025-12-31T15:00:00.000Z');
});

it('rejects an invalid input date rather than silently saving another day', () => {
  expect(() => getJapanDayBoundary(new Date(NaN), 'start')).toThrow('課題の日付が不正です');
});

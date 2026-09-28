import {Timestamp} from '@react-native-firebase/firestore';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import dayjs from 'dayjs';
import {getJapanTime} from './japanTime';
import ja from 'dayjs/locale/ja';

export const dateFormat = {
  hyphen: 'hyphen',
  slash: 'slash',
  kanji: 'kanji',
  none: 'none',
} as const;
export type DateFormat = (typeof dateFormat)[keyof typeof dateFormat];

export type MonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export const isMonthNumber = (arg: number): arg is MonthNumber => {
  return arg >= 1 && arg <= 12;
};

dayjs.locale(ja);

export const getTodayTimestamp = (): FirebaseFirestoreTypes.Timestamp => {
  // 東京の現在時刻を取得
  const tokyoDate = dayjs().toDate();
  // console.log('getTodayTimestamp: tokyoDate', tokyoDate);
  return Timestamp.fromDate(tokyoDate);
};
/*
export const getTodayTimestamp = () => {
  const now = Timestamp.now();
  return now;
};
*/

export const weeks = ['日', '月', '火', '水', '木', '金', '土'];
// 現在の年月日
export const now = getTodayTimestamp();
const d = getJapanTime(now.toDate());
export const currentYear = d.year();
// export const currentMonth = (d.month() + 1) as MonthNumber; // 月は0から始まる
const getCurrentMonth = () => {
  const currentMonth = (d.month() + 1) as MonthNumber; // 月は0から始まる
  const month = isMonthNumber(currentMonth) ? currentMonth : -1;
  if (month === -1) {
    console.error('currentMonth is invalid');
    throw new Error('currentMonth is invalid');
  }

  return month;
};

export const currentMonth = getCurrentMonth();
export const currentDate = d.date(); // 日にちは1から始まる

/** ミリ秒を取得 */
export const getMilliseconds = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
) => {
  return getJapanTime(timestamp.toDate()).millisecond();
};

/** 年月日時分を取得 */
const getDateTimeComponents = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
  const d = getJapanTime(timestamp.toDate());
  const year = d.year();
  const month = d.format('MM');
  const date = d.format('DD');
  const hour = d.format('HH');
  const minutes = d.format('mm');
  const seconds = d.format('ss');
  const millisecond = d.format('SSS');
  return {year, month, date, hour, minutes, seconds, millisecond};
};

export const getYmdhmsmString = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
) => {
  const {year, month, date, hour, minutes, seconds, millisecond} =
    getDateTimeComponents(timestamp);
  const ymdhmsm = `${year}${month}${date}${hour}${minutes}${seconds}${millisecond}`;
  return ymdhmsm;
};

/** 年月の文字列: YYYYMM */
export const getYmString = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
  const {year, month} = getDateTimeComponents(timestamp);
  const yyyyMm = `${year}${month}`;
  return yyyyMm;
};

/** 年月日の文字列 */
export const getYmdString = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
  type: DateFormat,
) => {
  const {year, month, date} = getDateTimeComponents(timestamp);
  switch (type) {
    case dateFormat.hyphen: {
      return `${year}-${month}-${date}`;
    }

    case dateFormat.slash: {
      return `${year}/${month}/${date}`;
    }

    case dateFormat.kanji: {
      return `${year}年${month}月${date}日`;
    }

    case dateFormat.none: {
      return `${year}${month}${date}`;
    }
  }
};

/** 月日の文字列: MM/DD */
export const getMdString = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
  const {month, date} = getDateTimeComponents(timestamp);
  const md = `${month}/${date}`;
  return md;
};

/** 日時の文字列: HH:MM */
export const getTimeString = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
  const {hour, minutes} = getDateTimeComponents(timestamp);
  const time = `${hour}:${minutes}`;
  return time;
};

/** 曜日の文字: 月～日 */
export const getDayOfWeekString = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
) => {
  const dayOfWeek = getJapanTime(timestamp.toDate()).day();
  return ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
};

/** 月日、曜日の文字列 */
export const getMdwString = (timestamp: FirebaseFirestoreTypes.Timestamp) => {
  const {month, date} = getDateTimeComponents(timestamp);
  const day = getDayOfWeekString(timestamp);
  const mdw = `${month}月${date}日(${day})`;
  return mdw;
};

/** 年月日、曜日の文字列: YYYY/MM/DD(W) */
export const getYmdDayString = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
) => {
  const ymd = getYmdString(timestamp, dateFormat.slash);
  const day = getDayOfWeekString(timestamp);
  const ymdDay = `${ymd}(${day})`;
  return ymdDay;
};

/** 年月日、曜日、時分の文字列: YYYY/MM/DD(W)HH:MM */
export const getYmdDayTimeString = (
  timestamp: FirebaseFirestoreTypes.Timestamp,
) => {
  const ymd = getYmdString(timestamp, dateFormat.slash);
  const day = getDayOfWeekString(timestamp);
  const time = getTimeString(timestamp);
  const ymdDayTime = `${ymd}(${day})${time}`;
  return ymdDayTime;
};

/** Date型から曜日の文字: 月～日を取得 */
export const getDateToDayOfWeekString = (d: Date) => {
  if (!Number.isFinite(d.getTime())) throw new Error('日付が不正です');
  const dayOfWeek = d.getDay();
  return ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
};

// Date型から年月日の文字列を取得
export const getDateToYmdString = (
  d: Date,
  type: DateFormat,
  hasDay?: boolean,
) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  const dayOfweek = getDateToDayOfWeekString(d);
  switch (type) {
    case dateFormat.hyphen: {
      if (hasDay) {
        return `${year}-${month}-${date}(${dayOfweek})`;
      }

      return `${year}-${month}-${date}`;
    }

    case dateFormat.slash: {
      if (hasDay) {
        return `${year}/${month}/${date}(${dayOfweek})`;
      }

      return `${year}/${month}/${date}`;
    }

    case dateFormat.kanji: {
      if (hasDay) {
        return `${year}年${month}月${date}日(${dayOfweek})`;
      }

      return `${year}年${month}月${date}日`;
    }

    case dateFormat.none: {
      if (hasDay) {
        return `${year}${month}${date}(${dayOfweek})`;
      }

      return `${year}${month}${date}`;
    }
  }
};

/** @params ミリ秒 */
// 時間
// 分秒
// 時分秒
export const timeUnitConverter = (msec: number) => {
  if (!Number.isFinite(msec) || msec < 0) throw new Error('所要時間が不正です');
  const sec = msec / 1000;
  const minutes = Math.floor(sec / 60);
  const displayHours = Math.floor(minutes / 60);
  const displayMinutes =
    minutes === 0 && displayHours === 0 && sec > 0 // 1分未満の場合切り上げて1分と表示する
      ? 1
      : String(minutes % 60).padStart(2, '0');
  const displaySeconds = String(Math.floor(sec % 60)).padStart(2, '0');
  const displayTime =
    sec > 3599
      ? `${displayHours}時間${displayMinutes}分`
      : sec > 179
        ? `${displayMinutes}分`
        : sec > 59
          ? `${displayMinutes}分${displaySeconds}秒`
          : `${displaySeconds}秒`;

  return displayTime;
};

/** 開始日から終了日までの日付を取得 */
export const getDatesBetween = (
  startAt: FirebaseFirestoreTypes.Timestamp,
  endAt: FirebaseFirestoreTypes.Timestamp,
) => {
  if (!startAt || !endAt) {
    throw new Error('startAt or endAt is undefined');
  }

  const dates = getDatesBetweenString(startAt, endAt, dateFormat.hyphen).map(
    (ymd) => {
      const [year, month, day] = ymd.split('-').map(Number);
      return new Date(year, month - 1, day);
    },
  );

  return dates;
};

export const getDatesBetweenString = (
  startAt: FirebaseFirestoreTypes.Timestamp,
  endAt: FirebaseFirestoreTypes.Timestamp,
  type: DateFormat,
) => {
  if (!startAt || !endAt) {
    throw new Error('startAt or endAt is undefined');
  }

  const patterns = {
    hyphen: 'YYYY-MM-DD',
    slash: 'YYYY/MM/DD',
    kanji: 'YYYY年MM月DD日',
    none: 'YYYYMMDD',
  };
  const dates: string[] = [];
  // UTC上の年月日として走査し、端末の夏時間・時差と二重のUTC+9加算を避ける。
  let current = dayjs.utc(getJapanTime(startAt.toDate()).format('YYYY-MM-DD'));
  const end = dayjs.utc(getJapanTime(endAt.toDate()).format('YYYY-MM-DD'));
  while (current.valueOf() <= end.valueOf()) {
    dates.push(current.format(patterns[type]));
    current = current.add(1, 'day');
  }

  return dates;
};

/** カレンダーの年月日を日本時間の開始・終了時刻へ変換する。 */
export const getJapanDayBoundary = (date: Date, boundary: 'start' | 'end') => {
  if (Number.isNaN(date.getTime())) throw new Error('課題の日付が不正です');
  const ymd = getDateToYmdString(date, dateFormat.hyphen);
  const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
  return new Date(`${ymd}T${time}+09:00`);
};

import dayjs, {type ConfigType} from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/** 日本時間は夏時間がないため、固定UTC+9で瞬間を変換する。 */
export const getJapanTime = (date?: ConfigType) => {
  const value = dayjs.utc(date).utcOffset(540);
  if (!value.isValid()) throw new Error('日本時間へ変換する日付が不正です');
  return value;
};

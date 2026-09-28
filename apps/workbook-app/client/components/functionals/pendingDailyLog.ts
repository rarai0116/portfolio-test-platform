import {Timestamp} from '@react-native-firebase/firestore';
import type {GradeNumber} from '../../types/commonUnionType';
import type {DailyLog, PlayRecordMap} from './firestoreController';

export type PendingBase =
  | {state: 'missing'}
  | {state: 'version'; lastUpdate: Timestamp}
  | {state: 'unknown'};

export type PendingDailyLog = {
  schemaVersion: 2;
  target: {
    uid: string;
    gradeNumber: GradeNumber;
    dailyLogId: string;
  };
  base: PendingBase;
  delta: DailyLog;
};

export const pendingDailyLogDataKey = 'pendingDailyLogData';
export const pendingDailyLogDataV2Key = 'pendingDailyLogDataV2';

export const createEmptyDailyLog = (uid = '', date = ''): DailyLog => ({
  uid,
  date,
  applied: false,
  playRecord: {},
  durationTime: [],
  answerList: [],
  answerIdList: [],
  correctAnswerList: [],
  newWeaklyAnswerIdRegisted: [],
  newWeaklyAnswerIdUnRegisted: [],
  newCorrectlyAnswerIdRegisted: [],
  lastUpdate: Timestamp.now(),
});

export const createPendingStorageId = (pending: PendingDailyLog) =>
  `${pending.target.uid}:${pending.target.dailyLogId}`;

const isTimestampLike = (
  value: unknown,
): value is {seconds: number; nanoseconds: number} => {
  if (!value || typeof value !== 'object') return false;
  const timestamp = value as Record<string, unknown>;
  return (
    typeof timestamp.seconds === 'number' &&
    typeof timestamp.nanoseconds === 'number'
  );
};

const reviveTimestamp = (value: unknown): Timestamp | null => {
  if (value instanceof Timestamp) return value;
  if (!isTimestampLike(value)) return null;
  return new Timestamp(value.seconds, value.nanoseconds);
};

const revivePlayRecord = (value: unknown): PlayRecordMap | null => {
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value).map(([key, record]) => {
    if (!record || typeof record !== 'object') return null;
    const raw = record as Record<string, unknown>;
    const startAt = reviveTimestamp(raw.startAt);
    const endAt = raw.endAt === null ? null : reviveTimestamp(raw.endAt);
    if (!startAt || (raw.endAt !== null && !endAt)) return null;
    return [key, {...raw, startAt, endAt}] as const;
  });
  if (entries.some((entry) => entry === null)) return null;
  return Object.fromEntries(
    entries as Array<readonly [string, PlayRecordMap[string]]>,
  );
};

const reviveDailyLog = (value: unknown): DailyLog | null => {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const requiredStringArrays = [
    'answerIdList',
    'newWeaklyAnswerIdRegisted',
    'newWeaklyAnswerIdUnRegisted',
    'newCorrectlyAnswerIdRegisted',
  ];
  const requiredNumberArrays = [
    'durationTime',
    'answerList',
    'correctAnswerList',
  ];
  if (
    typeof data.uid !== 'string' ||
    typeof data.date !== 'string' ||
    typeof data.applied !== 'boolean' ||
    !requiredStringArrays.every(
      (key) =>
        Array.isArray(data[key]) &&
        (data[key] as unknown[]).every((item) => typeof item === 'string'),
    ) ||
    !requiredNumberArrays.every(
      (key) =>
        Array.isArray(data[key]) &&
        (data[key] as unknown[]).every((item) => typeof item === 'number'),
    )
  )
    return null;

  const playRecord = revivePlayRecord(data.playRecord);
  const lastUpdate = reviveTimestamp(data.lastUpdate);
  if (!playRecord || !lastUpdate) return null;
  return {...data, playRecord, lastUpdate} as DailyLog;
};

export const revivePendingDailyLog = (
  value: unknown,
): PendingDailyLog | null => {
  if (!value || typeof value !== 'object') return null;
  const pending = value as Record<string, unknown>;
  if (pending.schemaVersion !== 2) return null;
  if (!pending.target || typeof pending.target !== 'object') return null;
  const target = pending.target as Record<string, unknown>;
  if (
    typeof target.uid !== 'string' ||
    (target.gradeNumber !== 1 && target.gradeNumber !== 2) ||
    typeof target.dailyLogId !== 'string'
  )
    return null;

  if (!pending.base || typeof pending.base !== 'object') return null;
  const rawBase = pending.base as Record<string, unknown>;
  let base: PendingBase;
  if (rawBase.state === 'missing' || rawBase.state === 'unknown') {
    base = {state: rawBase.state};
  } else if (rawBase.state === 'version') {
    const lastUpdate = reviveTimestamp(rawBase.lastUpdate);
    if (!lastUpdate) return null;
    base = {state: 'version', lastUpdate};
  } else {
    return null;
  }

  const delta = reviveDailyLog(pending.delta);
  if (!delta) return null;
  return {
    schemaVersion: 2,
    target: {
      uid: target.uid,
      gradeNumber: target.gradeNumber,
      dailyLogId: target.dailyLogId,
    },
    base,
    delta,
  };
};

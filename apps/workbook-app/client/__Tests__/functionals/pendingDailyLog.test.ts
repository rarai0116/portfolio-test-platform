import {Timestamp} from '@react-native-firebase/firestore';
import {
  createEmptyDailyLog,
  createPendingStorageId,
  revivePendingDailyLog,
  type PendingDailyLog,
} from '../../components/functionals/pendingDailyLog';

const createPending = (): PendingDailyLog => ({
  schemaVersion: 2,
  target: {
    uid: 'user-1',
    gradeNumber: 1,
    dailyLogId: '20260915_1_user-1',
  },
  base: {state: 'version', lastUpdate: new Timestamp(100, 200)},
  delta: {
    ...createEmptyDailyLog('user-1', '20260915'),
    playRecord: {
      '100000': {
        startAt: new Timestamp(100, 0),
        endAt: null,
      },
    },
  },
});

describe('pendingDailyLog', () => {
  it('creates independent DailyLog arrays', () => {
    const first = createEmptyDailyLog();
    const second = createEmptyDailyLog();
    first.answerList.push(1);
    expect(second.answerList).toEqual([]);
  });

  it('revives persisted timestamps', () => {
    const persisted = JSON.parse(JSON.stringify(createPending())) as unknown;
    const revived = revivePendingDailyLog(persisted);
    expect(revived?.base.state).toBe('version');
    if (revived?.base.state === 'version') {
      expect(revived.base.lastUpdate).toBeInstanceOf(Timestamp);
      expect(revived.base.lastUpdate.seconds).toBe(100);
      expect(revived.base.lastUpdate.nanoseconds).toBe(200);
    }
    expect(revived?.delta.playRecord['100000'].startAt).toBeInstanceOf(
      Timestamp,
    );
  });

  it('rejects an invalid envelope without coercing it to legacy data', () => {
    const invalid = {...createPending(), target: {uid: 'user-1'}};
    expect(revivePendingDailyLog(invalid)).toBeNull();
  });

  it('uses uid and DailyLog id for the storage id', () => {
    expect(createPendingStorageId(createPending())).toBe(
      'user-1:20260915_1_user-1',
    );
  });
});

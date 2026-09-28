import {getAuth} from '@react-native-firebase/auth';
import {
  getDocFromServer,
  setDoc,
  Timestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  createDailyLogId,
  updateDailyLog,
} from '../../components/functionals/firestoreController';

const uid = 'test-uid';
const startAt = Timestamp.fromDate(new Date('2026-09-15T10:00:00+09:00'));
const recordKey = startAt.toMillis().toString();

const createInput = () => {
  const dailyLogId = createDailyLogId(startAt, uid, 1);
  return {
    dailyLogId,
    input: {
      gradeNumber: 1 as const,
      _answerList: [10],
      _answerIdList: ['answer-10'],
      _correctAnswerList: [10],
      _newWeaklyAnswerIdRegisted: [],
      _newWeaklyAnswerIdUnRegisted: [],
      _newCorrectlyAnswerIdRegisted: ['answer-10'],
      weaklyAnswerIdList: [],
      startAt,
      syncContext: {
        source: 'pending' as const,
        dailyLogId,
        playRecord: {
          [recordKey]: {startAt, endAt: null},
        },
      },
    },
  };
};

describe('updateDailyLog pending conflict handling', () => {
  beforeEach(() => {
    (getAuth() as unknown as {currentUser: {uid: string}}).currentUser = {uid};
    jest.clearAllMocks();
  });

  it('discards a pending delta when the server version is newer', async () => {
    const {input} = createInput();
    jest.mocked(getDocFromServer).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({lastUpdate: new Timestamp(200, 0)}),
    } as never);

    const result = await updateDailyLog({
      ...input,
      syncContext: {
        ...input.syncContext,
        base: {state: 'version', lastUpdate: new Timestamp(100, 0)},
      },
    });

    expect(result.status).toBe('discarded');
    expect(updateDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('discards a pending delta when a previously missing document exists', async () => {
    const {input} = createInput();
    jest.mocked(getDocFromServer).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({lastUpdate: new Timestamp(200, 0)}),
    } as never);

    const result = await updateDailyLog({
      ...input,
      syncContext: {...input.syncContext, base: {state: 'missing'}},
    });

    expect(result.status).toBe('discarded');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('creates a complete nested playRecord map when the base is unknown', async () => {
    const {dailyLogId, input} = createInput();
    jest.mocked(getDocFromServer).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    } as never);

    const result = await updateDailyLog({
      ...input,
      syncContext: {...input.syncContext, base: {state: 'unknown'}},
    });

    expect(result).toEqual({status: 'success', dailyLogId});
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        uid,
        date: dailyLogId.slice(0, 8),
        applied: false,
        playRecord: expect.objectContaining({[recordKey]: expect.anything()}),
      }),
    );
  });
});

import React, {useContext} from 'react';
import {act, render, renderHook, waitFor} from '@testing-library/react-native';
import {getAuth, type FirebaseAuthTypes} from '@react-native-firebase/auth';
import {
  getDocFromServer,
  setDoc,
  updateDoc,
  Timestamp,
} from '@react-native-firebase/firestore';
import {createDailyLogId} from '../../components/functionals/firestoreController';
import {
  createEmptyDailyLog,
  createPendingStorageId,
  revivePendingDailyLog,
  type PendingDailyLog,
} from '../../components/functionals/pendingDailyLog';
import {StorageContext} from '../../components/hooks/useAsyncStorageContext';
import {
  GlobalSaveDataContext,
  type TestPlayData,
} from '../../components/hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '../../components/hooks/useGlobalUserSettingContext';
import {QuestionSettingViewContext} from '../../components/hooks/useQuestionSettingViewContext';
import {
  QuestionAndChoicesViewContext,
  QuestionAndChoicesViewContextProvider,
  type QuestionAndChoicesViewContextObject,
} from '../../components/hooks/useQuestionsAndChoicesViewContext';
import useDailyLog from '../../components/hooks/useDailyLogData';

// Keep the real DailyLog writer; isolate the unrelated test-history write.
jest.mock('../../components/functionals/firestoreController', () => {
  const actual = jest.requireActual(
    '../../components/functionals/firestoreController',
  );
  return {
    ...actual,
    __esModule: true,
    default: {app: {auth: () => ({currentUser: {uid: 'test-uid'}})}},
    updateTestData: jest.fn(async () => undefined),
  };
});
jest.mock('../../components/functionals/analyticsController', () => ({
  logErrorToAnalytics: jest.fn(),
}));

type StorageValue = React.ContextType<typeof StorageContext>;
const uid = 'test-uid';
const startAt = Timestamp.fromDate(new Date('2026-09-15T10:00:00+09:00'));
const recordKey = startAt.toMillis().toString();
const dailyLogId = createDailyLogId(startAt, uid, 1);
const storageId = `${uid}:${dailyLogId}`;
const createPending = (): PendingDailyLog => ({
  schemaVersion: 2,
  target: {uid, gradeNumber: 1, dailyLogId},
  base: {state: 'unknown'},
  delta: {
    ...createEmptyDailyLog(uid, dailyLogId.slice(0, 8)),
    answerList: [10],
    answerIdList: ['answer-10'],
    correctAnswerList: [10],
    playRecord: {[recordKey]: {startAt, endAt: null}},
  },
});

// Model persisted storage independently of React mounts, including JSON serialization.
const createStorage = () => {
  const persisted = new Map<string, string>();
  const savePendingDailyLog = jest.fn(async (pending: PendingDailyLog) => {
    persisted.set(createPendingStorageId(pending), JSON.stringify(pending));
  });
  const loadPendingDailyLog = jest.fn(async (id: string) => {
    const json = persisted.get(id);
    return json ? revivePendingDailyLog(JSON.parse(json)) : null;
  });
  const listPendingDailyLogs = jest.fn(async (owner: string) => {
    const logs: PendingDailyLog[] = [];
    for (const id of persisted.keys()) {
      const pending = await loadPendingDailyLog(id);
      if (pending?.target.uid === owner) logs.push(pending);
    }
    return logs;
  });
  const deletePendingDailyLog = jest.fn(async (id: string) => {
    persisted.delete(id);
  });
  const value = {
    savePendingDailyLog,
    loadPendingDailyLog,
    listPendingDailyLogs,
    deletePendingDailyLog,
    loadLegacyPendingDailyLog: jest.fn(async () => null),
    deleteLegacyPendingDailyLog: jest.fn(),
  } as unknown as StorageValue;
  return {
    persisted,
    value,
    savePendingDailyLog,
    loadPendingDailyLog,
    deletePendingDailyLog,
  };
};

const Reader = ({
  capture,
}: {
  readonly capture: (value: QuestionAndChoicesViewContextObject) => void;
}) => {
  capture(useContext(QuestionAndChoicesViewContext));
  return null;
};

const mountFinishedTest = (storage: StorageValue) => {
  let context!: QuestionAndChoicesViewContextObject;
  // Track callback completion because testFinishedProcess schedules it without awaiting it.
  const setIsDisabledInput = jest.fn(
    async (_value: boolean, callback?: () => Promise<void>) => {
      await callback?.();
    },
  );
  const currentPlayData = {
    testId: 'test-1',
    settingCardData: {},
    testDataNoList: [],
    answerList: [1],
    selectedAnswerList: [1],
    durationTimePerAnswer: [],
    startAt,
    limitTime: -1,
    isQaa: false,
  } as unknown as TestPlayData;
  const user = {
    currentDailyLog: createPending().delta,
    currentRecordKey: recordKey,
    currentPlayData,
    grade: '1級',
    isLoading: true,
    testIdList: {weakPoint: {total: []}, correctlyAnswered: {total: []}},
    setIsDisabledInput,
    readyForTest: {isUser: false, initialize: jest.fn()},
  } as unknown as React.ContextType<typeof GlobalUserSettingContext>;
  const save = {
    getTestDataList: () => [],
    setAnswerlingTestSettingData: jest.fn(async () => undefined),
    updateAllDataLengthMap: jest.fn(),
  } as unknown as React.ContextType<typeof GlobalSaveDataContext>;
  const view = render(
    <StorageContext.Provider value={storage}>
      <GlobalSaveDataContext.Provider value={save}>
        <GlobalUserSettingContext.Provider value={user}>
          <QuestionSettingViewContext.Provider
            value={{} as React.ContextType<typeof QuestionSettingViewContext>}
          >
            <QuestionAndChoicesViewContextProvider>
              <Reader
                capture={(value) => {
                  context = value;
                }}
              />
            </QuestionAndChoicesViewContextProvider>
          </QuestionSettingViewContext.Provider>
        </GlobalUserSettingContext.Provider>
      </GlobalSaveDataContext.Provider>
    </StorageContext.Provider>,
  );
  return {
    ...view,
    finish: async () => {
      await act(async () => {
        await context.testFinishedProcess();
        await setIsDisabledInput.mock.results[0].value;
      });
    },
  };
};

const mountStartupReplay = (storage: StorageValue) => {
  const hook = renderHook(
    () =>
      useDailyLog({
        isAuthenticated: true,
        loginUser: {uid} as FirebaseAuthTypes.User,
        grade: '1級',
        gradeNumber: 1,
        setIsReloadRequired: jest.fn(),
      }),
    {
      wrapper: ({children}: {readonly children: React.ReactNode}) => (
        <StorageContext.Provider value={storage}>
          {children}
        </StorageContext.Provider>
      ),
    },
  );
  return {
    ...hook,
    replay: async () => {
      await act(async () => {
        hook.result.current.setOldTestIdList({answered: [], weakPoint: []});
        hook.result.current.testIdList.weakPoint.set([], []);
      });
      await act(async () => {
        await hook.result.current.applyPendingDailyLog();
      });
    },
  };
};

describe('DailyLog pending persistence across test completion and restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth() as unknown as {currentUser: {uid: string}}).currentUser = {uid};
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    'create',
    'update',
  ] as const)('keeps pending data after a failed %s and replays it after remounting', async (operation) => {
    const storage = createStorage();
    await storage.savePendingDailyLog(createPending());
    const snapshot =
      operation === 'create'
        ? {exists: () => false, data: () => undefined}
        : {exists: () => true, data: () => createPending().delta};
    jest.mocked(getDocFromServer).mockResolvedValue(snapshot as never);
    const writer = operation === 'create' ? setDoc : updateDoc;
    jest.mocked(writer).mockRejectedValueOnce(new Error('permission-denied'));
    const view = mountFinishedTest(storage.value);
    await view.finish();

    expect(writer).toHaveBeenCalledTimes(1);
    expect(storage.deletePendingDailyLog).not.toHaveBeenCalled();
    const retained = await storage.loadPendingDailyLog(storageId);
    expect(retained?.delta.answerIdList).toEqual(['answer-10']);
    expect(retained?.delta.playRecord[recordKey].endAt).toBeInstanceOf(
      Timestamp,
    );
    view.unmount();

    const startup = mountStartupReplay(storage.value);
    await startup.replay();
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        uid,
        answerIdList: expect.objectContaining({values: ['answer-10']}),
      }),
    );
    expect(storage.deletePendingDailyLog).toHaveBeenCalledWith(storageId);
    expect(storage.persisted.has(storageId)).toBe(false);
    startup.unmount();
  });

  it('keeps pending data when startup replay also fails', async () => {
    const storage = createStorage();
    await storage.savePendingDailyLog(createPending());
    jest
      .mocked(getDocFromServer)
      .mockResolvedValue({exists: () => false, data: () => undefined} as never);
    jest.mocked(setDoc).mockRejectedValueOnce(new Error('offline'));
    const startup = mountStartupReplay(storage.value);
    await startup.replay();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(storage.deletePendingDailyLog).not.toHaveBeenCalled();
    expect(
      (await storage.loadPendingDailyLog(storageId))?.delta.answerIdList,
    ).toEqual(['answer-10']);
    startup.unmount();
  });

  it('deletes pending data only after the completion write succeeds', async () => {
    const storage = createStorage();
    await storage.savePendingDailyLog(createPending());
    jest
      .mocked(getDocFromServer)
      .mockResolvedValue({exists: () => false, data: () => undefined} as never);
    let completeWrite!: () => void;
    jest.mocked(setDoc).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeWrite = resolve;
        }),
    );
    const view = mountFinishedTest(storage.value);
    const finish = view.finish();
    await waitFor(() => {
      expect(setDoc).toHaveBeenCalledTimes(1);
    });
    expect(storage.persisted.has(storageId)).toBe(true);
    expect(storage.deletePendingDailyLog).not.toHaveBeenCalled();
    await act(async () => {
      completeWrite();
      await finish;
    });
    expect(storage.deletePendingDailyLog).toHaveBeenCalledWith(storageId);
    expect(storage.persisted.has(storageId)).toBe(false);
    view.unmount();
  });
});

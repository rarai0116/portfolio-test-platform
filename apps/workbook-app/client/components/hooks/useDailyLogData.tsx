import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useContext,
  useRef,
} from 'react';
import {
  getFirestore,
  doc,
  onSnapshot,
  Timestamp,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import type * as FirebaseAuthTypes from '@react-native-firebase/auth';
import type {DailyLog} from '../functionals/firestoreController';
import {
  createEmptyDailyLog,
  createPendingStorageId,
  type PendingBase,
  type PendingDailyLog,
} from '../functionals/pendingDailyLog';
import {
  updateDailyLog,
  getDailyLog,
  createDailyLogId,
  createDailyLog,
  compareDailyLog,
  getDailyLogRecord,
} from '../functionals/firestoreController';
import type {GradeNumber, QuestionGradeType} from '../../types/commonUnionType';
import {generateTestDataId} from '../functionals/testDataController';
import type {TestData} from './useGlobalSaveDataContext';
import {StorageContext} from './useAsyncStorageContext';

type DailyLogStore = Record<string, DailyLog>;
export type TestIdList = {
  answered: {
    current: string[];
    old: string[];
    total: string[];
    set: (newlist: string[]) => void;
  };
  weakPoint: {
    current: string[];
    old: string[];
    total: string[];
    set: (
      newWeaklyAnswerIdRegisted: string[],
      newWeaklyAnswerIdUnRegisted: string[],
    ) => void;
  };
  correctlyAnswered: {
    current: string[];
    old: string[];
    total: string[];
    set: (newlist: string[]) => void;
  };
  unCorrectlyAnswered: {
    current: string[];
    old: string[];
    total: string[];
  };
  /*  weakPointOrUnAnsweredTest: {
    current: string[];
    old: string[];
    total: string[];
  };
*/
  generate: (data: TestData, isQaa: boolean) => string;
};
type TestIdSet = {
  [key: string]: string[];
  current: string[];
  old: string[];
  total: string[];
};
type Unsubscribe = () => void;

type OldTestIdListProp = {
  answered: string[];
  correctlyAnswered?: string[];
  weakPoint?: string[];
  playTime?: number;
};

type Props = {
  readonly isAuthenticated: boolean;
  readonly loginUser: FirebaseAuthTypes.User | null;
  readonly grade?: QuestionGradeType;
  readonly gradeNumber: GradeNumber | null;
  readonly setIsReloadRequired: React.Dispatch<React.SetStateAction<boolean>>;
  readonly uid?: string;
};
export type UseDailyLogData = {
  currentDailyLog: DailyLog | null;
  setCurrentDailyLog: React.Dispatch<React.SetStateAction<DailyLog | null>>;
  oldDailyLogStore: DailyLogStore;
  testIdList: TestIdList;
  startCurrentDailyLogConnect: () => Promise<'success' | 'failed' | 'error'>;
  initialDailyLog: DailyLog;
  setOldTestIdList: (props: OldTestIdListProp) => void;
  dailyDataUnsubscribe: Unsubscribe | null;
  setDailyDataUnsubscribe: React.Dispatch<
    React.SetStateAction<Unsubscribe | null>
  >;
  applyPendingDailyLog: () => Promise<void>;
  getPendingBase: (dailyLogId: string) => PendingBase;
};
// ローカルのDailyLog
export const initialDailyLog: DailyLog = createEmptyDailyLog();

const useDailyLog = (props: Props) => {
  const firestore = getFirestore();
  const _auth = getAuth();

  const {
    savePendingDailyLog,
    listPendingDailyLogs,
    deletePendingDailyLog,
    loadLegacyPendingDailyLog,
    deleteLegacyPendingDailyLog,
  } = useContext(StorageContext);
  const confirmedDailyLogBaseRef = useRef<{
    dailyLogId: string;
    base: PendingBase;
  } | null>(null);

  // 当日のデイリーログ
  const [currentDailyLog, setCurrentDailyLog] = useState<DailyLog | null>(null);
  // 過去のデイリーログ
  const [oldDailyLogStore, setOldDailyLogStore] = useState<DailyLogStore>({});
  /** 回答済み・正答済み・苦手問題IDリスト・プレイ時間
   * 当日(current)・前日までのデータ(old)・当日/前日までのデータを再計算したデータ(original)の3つに分かれている
   * current: firestoreとは半同期状態(送信時と変更検知時のみ同期・必ずしも常に同期しているとは限らない)
   * old: firestoreとはオフライン時以外同期
   * original: currentとoldのデータを統合したデータ
   */
  // current
  // 当日回答済み問題IDリスト
  const [currentAnsweredTestIdList, _setCurrentAnsweredTestIdList] = useState<
    string[]
  >([]);
  // 当日正答済み問題IDリスト
  const [currentCorrectlyAnsweredIdList, _setCurrentCorrectlyAnsweredIdList] =
    useState<string[]>([]);
  // 当日苦手問題IDリスト
  const [currentWeakPointTestIdList, _setCurrentWeakPointTestIdList] = useState<
    string[]
  >([]);
  const [newWeaklyAnswerIdUnRegisted, setNewWeaklyAnswerIdUnRegisted] =
    useState<string[]>([]);
  const [_currentPlayTime, _setCurrentPlayTime] = useState<number>(0);
  // old
  // 前日回答済み問題IDリスト
  const [oldAnsweredTestIdList, setOldAnsweredTestIdList] = useState<string[]>(
    [],
  );
  // 前日正答済み問題IDリスト
  const [oldCorrectlyAnsweredIdList, setOldCorrectlyAnsweredIdList] = useState<
    string[]
  >([]);
  // 前日苦手問題IDリスト
  const [oldWeakPointTestIdList, setOldWeakPointTestIdList] = useState<
    string[]
  >([]);
  const [_oldPlayTime, setOldPlayTime] = useState<number>(0);
  // 苦手問題データの準備が完了しているか
  const [isWeakPointDataReady, setIsWeakPointDataReady] = useState<{
    old: boolean;
    current: boolean;
  }>({old: false, current: false});
  const [dailyDataUnsubscribe, setDailyDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  const answeredTestIdList: TestIdSet = useMemo(() => {
    return {
      current: currentAnsweredTestIdList,
      old: oldAnsweredTestIdList,
      total: Array.from(
        new Set([...oldAnsweredTestIdList, ...currentAnsweredTestIdList]),
      ),
    };
  }, [oldAnsweredTestIdList, currentAnsweredTestIdList]);
  const correctlyAnsweredIdList: TestIdSet = useMemo(() => {
    return {
      current: currentCorrectlyAnsweredIdList,
      old: oldCorrectlyAnsweredIdList,
      total: Array.from(
        new Set([
          ...oldCorrectlyAnsweredIdList,
          ...currentCorrectlyAnsweredIdList,
        ]),
      ),
    };
  }, [oldCorrectlyAnsweredIdList, currentCorrectlyAnsweredIdList]);
  const weakPointTestIdList: TestIdSet = useMemo(() => {
    return {
      current: currentWeakPointTestIdList,
      old: oldWeakPointTestIdList,
      total: Array.from(
        new Set(
          [...oldWeakPointTestIdList, ...currentWeakPointTestIdList].filter(
            (value) => !newWeaklyAnswerIdUnRegisted.includes(value),
          ),
        ),
      ),
    };
  }, [
    oldWeakPointTestIdList,
    currentWeakPointTestIdList,
    newWeaklyAnswerIdUnRegisted,
  ]);
  /** 不正解問題IDリスト */
  const unCorrectlyAnsweredTestIdList: TestIdSet = useMemo(() => {
    return Object.keys(answeredTestIdList).reduce<TestIdSet>(
      (acc, key) => {
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [key]: answeredTestIdList[key].filter(
            (value) => !correctlyAnsweredIdList[key].includes(value),
          ),
        };
      },
      {current: [], old: [], total: []},
    );
  }, [answeredTestIdList, correctlyAnsweredIdList]);
  // 未回答または苦手な問題IDリスト
  /*
  const weakPointOrUnAnsweredTestIdList: TestIdSet = useMemo(() => {
    const idList =
    return Object.keys(unCorrectlyAnsweredTestIdList).reduce<TestIdSet>(
      (acc, key) => {
        return {
          ...acc,
          [key]: unCorrectlyAnsweredTestIdList[key].filter((value) =>
            weakPointTestIdList[key].includes(value),
          ),
        };
      },
      {current: [], old: [], total: []},
    );
  }, [unCorrectlyAnsweredTestIdList, weakPointTestIdList]);
  */

  /** useCallBack */
  // 過去のデイリーログを全て取得
  const fetchOldDailyLog = useCallback(async () => {
    if (!props.grade || !props.gradeNumber || !props.loginUser?.uid) return {};
    const dailyLogStore: DailyLogStore = {};
    const dailyLogs = await getDailyLogRecord(
      props.loginUser?.uid,
      props.gradeNumber,
    ).catch((error: unknown) => {
      console.error('getOldDailyLogRecord error', error);
      throw new Error('過去のデイリーログの取得に失敗しました');
    });

    if (oldDailyLogStore !== dailyLogs) setOldDailyLogStore(dailyLogs);
    return dailyLogStore;
  }, [props.grade, props.gradeNumber, props.loginUser?.uid, oldDailyLogStore]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentAnsweredTestIdList = useCallback(
    (newlist: string[]) => {
      _setCurrentAnsweredTestIdList((list) => {
        const newAnsweredTestlist = Array.from(new Set([...list, ...newlist]));

        return newAnsweredTestlist;
      });
    },
    [_setCurrentAnsweredTestIdList],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentCorrectlyAnsweredIdList = useCallback(
    (newlist: string[]) => {
      _setCurrentCorrectlyAnsweredIdList((list) => {
        const newAnsweredTestlist = Array.from(new Set([...list, ...newlist]));

        return newAnsweredTestlist;
      });
    },
    [_setCurrentCorrectlyAnsweredIdList],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentWeakPointTestIdList = useCallback(
    (
      newWeaklyAnswerIdRegisted: string[],
      _newWeaklyAnswerIdUnRegisted: string[],
    ) => {
      const _newWeaklyAnswerIdUnRegisted2 = new Set(
        Array.from(
          new Set(
            _newWeaklyAnswerIdUnRegisted.filter(
              (value) =>
                currentWeakPointTestIdList.includes(value) ||
                oldWeakPointTestIdList.includes(value),
            ),
          ),
        ),
      );
      setNewWeaklyAnswerIdUnRegisted(_newWeaklyAnswerIdUnRegisted);
      _setCurrentWeakPointTestIdList((list) => {
        const newList = [...list, ...newWeaklyAnswerIdRegisted].filter(
          (value, _index, _self) => {
            // 苦手解除した問題を削除
            return !_newWeaklyAnswerIdUnRegisted2.has(value);
          },
        );
        // 重複を削除
        const sets = new Set(newList);
        const newWeakPointTestlist = Array.from(sets);

        return newWeakPointTestlist;
      });
      setIsWeakPointDataReady((prev) => ({
        ...prev,
        current: true,
      }));
    },
    [
      _setCurrentWeakPointTestIdList,
      currentWeakPointTestIdList,
      oldWeakPointTestIdList,
    ],
  );
  // デイリーログ情報取得リスナー
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setDailyLogListener: (id: string) => Unsubscribe | null = useCallback(
    (id: string) => {
      const dailyLogRef = doc(
        firestore,
        'users',
        '_log',
        'changedDailyLog',
        id,
      );
      return onSnapshot(
        dailyLogRef,
        (doc) => {
          try {
            const data = doc.data() as DailyLog | undefined;
            if (doc.metadata.fromCache === false) {
              if (!doc.exists()) {
                confirmedDailyLogBaseRef.current = {
                  dailyLogId: id,
                  base: {state: 'missing'},
                };
              } else if (data?.lastUpdate instanceof Timestamp) {
                confirmedDailyLogBaseRef.current = {
                  dailyLogId: id,
                  base: {state: 'version', lastUpdate: data.lastUpdate},
                };
              } else {
                confirmedDailyLogBaseRef.current = null;
              }
            }
            if (data) {
              // currentDailyLogと受け取ったデータを比較
              // 日付処理による変更だった場合(appliedがtrue)、currentDailyLogと受け取ったデータの差分を抽出してDailyLogを新たに作成
              if (data.applied && props.gradeNumber && currentDailyLog) {
                const diff = compareDailyLog(currentDailyLog, data);

                createDailyLog(
                  props.gradeNumber,
                  Timestamp.now(),
                  diff ?? undefined,
                )
                  .then((result) => {
                    if (result.status === 'success') {
                      const dailyLogResult = result.dailyLogData;
                      if (currentDailyLog !== dailyLogResult)
                        setCurrentDailyLog(dailyLogResult);
                      if (dailyDataUnsubscribe !== null) dailyDataUnsubscribe();
                      setDailyDataUnsubscribe(null);
                      console.info('デイリーログ再監視');
                      startCurrentDailyLogConnect().catch((error: unknown) => {
                        console.error('デイリーログ監視失敗', error);
                      });
                    }
                  })
                  .catch((error: unknown) => {
                    console.error('updateDailyLog error', error);
                  });
                return;
              } else if (currentDailyLog !== data) setCurrentDailyLog(data);

              // currentDailyLogと受け取ったデータを比較してlastUpdateが受け取ったデータの方が新しい場合、別の端末で操作が行われたと判断し、リロード
              if (
                currentDailyLog &&
                currentDailyLog.uid === data.uid &&
                data.lastUpdate instanceof Timestamp &&
                currentDailyLog.lastUpdate instanceof Timestamp &&
                data.lastUpdate.toMillis() >
                  currentDailyLog.lastUpdate.toMillis()
              ) {
                console.warn(
                  '⭐️⭐️⭐️リロードが必要です',
                  summarizeConsoleValue(data.lastUpdate),
                  summarizeConsoleValue(currentDailyLog),
                );
                props.setIsReloadRequired(true);
              }
            }
          } catch (error) {
            console.error('setDailyLogListener error', error);
          }
        },
        (error) => {
          console.error('setDailyLogListener error', error);
        },
      );
    },
    [
      currentDailyLog,
      dailyDataUnsubscribe,
      firestore,
      props,
      setCurrentDailyLog,
    ],
  );

  const getPendingBase = useCallback((dailyLogId: string): PendingBase => {
    return confirmedDailyLogBaseRef.current?.dailyLogId === dailyLogId
      ? confirmedDailyLogBaseRef.current.base
      : {state: 'unknown'};
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    confirmedDailyLogBaseRef.current = null;
  }, [props.gradeNumber, props.loginUser?.uid]);
  // デイリーログの監視開始
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const startCurrentDailyLogConnect = useCallback(async () => {
    if (props.isAuthenticated && props.grade && props.loginUser?.uid) {
      const today = Timestamp.now();
      const dailyLogId = createDailyLogId(
        today,
        props.loginUser?.uid,
        props.grade === '1級' ? 1 : 2,
      );
      // 過去のデイリーログを取得(並列処理)
      fetchOldDailyLog()
        .then((oldlog) => {
          console.info(
            '過去のデイリーログ取得完了',
            summarizeConsoleValue(oldlog),
          );
        })
        .catch((error: unknown) => {
          console.error('過去のデイリーログ取得失敗', error);
        });
      // 今日のデイリーログを取得
      const dailyLogResult = await getDailyLog(
        props.grade === '1級' ? 1 : 2,
        today,
      );
      if (dailyLogResult.status === 'success' && dailyLogResult.dailyLog) {
        if (currentDailyLog !== dailyLogResult.dailyLog)
          setCurrentDailyLog(dailyLogResult.dailyLog);
        setCurrentAnsweredTestIdList(dailyLogResult.dailyLog.answerIdList);
        setCurrentCorrectlyAnsweredIdList(
          dailyLogResult.dailyLog.newCorrectlyAnswerIdRegisted,
        );
        setCurrentWeakPointTestIdList(
          dailyLogResult.dailyLog.newWeaklyAnswerIdRegisted,
          dailyLogResult.dailyLog.newWeaklyAnswerIdUnRegisted,
        );
      } else {
        // デイリーログが存在しない場合、新規作成
        const dailyLog = await createDailyLog(
          props.grade === '1級' ? 1 : 2,
          today,
        );
        if (dailyLog.status === 'error') {
          console.error('デイリーログの作成に失敗しました', dailyLog);
          return 'error';
        }

        if (currentDailyLog !== dailyLog.dailyLogData)
          setCurrentDailyLog(dailyLog.dailyLogData);
      }

      const dailyLogUnsub = setDailyLogListener(dailyLogId);

      setDailyDataUnsubscribe(() => dailyLogUnsub);
      return 'success';
    } else if (dailyDataUnsubscribe !== null) {
      dailyDataUnsubscribe();
      setDailyDataUnsubscribe(() => null);
    }

    return 'failed';
  }, [
    currentDailyLog,
    setDailyLogListener,
    props,
    dailyDataUnsubscribe,
    setCurrentDailyLog,
    setCurrentAnsweredTestIdList,
    setCurrentCorrectlyAnsweredIdList,
    setCurrentWeakPointTestIdList,
    fetchOldDailyLog,
  ]);

  const testIdList = useMemo(() => {
    return {
      answered: {...answeredTestIdList, set: setCurrentAnsweredTestIdList},
      weakPoint: {...weakPointTestIdList, set: setCurrentWeakPointTestIdList},
      correctlyAnswered: {
        ...correctlyAnsweredIdList,
        set: setCurrentCorrectlyAnsweredIdList,
      },
      unCorrectlyAnswered: unCorrectlyAnsweredTestIdList,
      //      weakPointOrUnAnsweredTest: weakPointOrUnAnsweredTestIdList,
      generate: generateTestDataId,
    };
  }, [
    answeredTestIdList,
    weakPointTestIdList,
    correctlyAnsweredIdList,
    unCorrectlyAnsweredTestIdList,
    //    weakPointOrUnAnsweredTestIdList,
    setCurrentAnsweredTestIdList,
    setCurrentWeakPointTestIdList,
    setCurrentCorrectlyAnsweredIdList,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setOldTestIdList = useCallback(
    ({answered, correctlyAnswered, weakPoint, playTime}: OldTestIdListProp) => {
      setOldAnsweredTestIdList(answered);
      setIsWeakPointDataReady((prev) => ({
        ...prev,
        old: true,
      }));
      if (correctlyAnswered) setOldCorrectlyAnsweredIdList(correctlyAnswered);
      if (weakPoint) setOldWeakPointTestIdList(weakPoint);
      if (playTime) setOldPlayTime(playTime);
    },
    [
      setOldAnsweredTestIdList,
      setOldCorrectlyAnsweredIdList,
      setOldWeakPointTestIdList,
      setOldPlayTime,
    ],
  );

  // 蓄積デイリーログが存在するか確認し、存在する場合は適用
  const applyPendingDailyLog = useCallback(async () => {
    if (
      !props.grade ||
      !props.loginUser?.uid ||
      !isWeakPointDataReady.current ||
      !isWeakPointDataReady.old
    )
      return;
    const uid = props.loginUser.uid;
    const gradeNumber = props.grade === '1級' ? 1 : 2;
    try {
      const legacy = await loadLegacyPendingDailyLog();
      if (legacy) {
        const record = legacy.playRecord[Object.keys(legacy.playRecord)[0]];
        if (!record?.startAt)
          throw new Error('旧保留デイリーログに開始日時がありません');
        const dailyLogId = createDailyLogId(record.startAt, uid, gradeNumber);
        const migrated: PendingDailyLog = {
          schemaVersion: 2,
          target: {uid, gradeNumber, dailyLogId},
          base: {state: 'unknown'},
          delta: {...legacy, uid, date: dailyLogId.slice(0, 8)},
        };
        await savePendingDailyLog(migrated);
        await deleteLegacyPendingDailyLog();
      }

      const pendingLogs = await listPendingDailyLogs(uid);
      for (const pending of pendingLogs) {
        // 苦手問題リストは選択中の学年のものだけなので、他学年は保持する。
        if (pending.target.gradeNumber !== gradeNumber) continue;
        const record =
          pending.delta.playRecord[Object.keys(pending.delta.playRecord)[0]];
        if (!record?.startAt)
          throw new Error('保留デイリーログに開始日時がありません');
        const result = await updateDailyLog({
          gradeNumber: pending.target.gradeNumber,
          _answerList: pending.delta.answerList,
          _answerIdList: pending.delta.answerIdList,
          _correctAnswerList: pending.delta.correctAnswerList,
          _newWeaklyAnswerIdRegisted: pending.delta.newWeaklyAnswerIdRegisted,
          _newWeaklyAnswerIdUnRegisted:
            pending.delta.newWeaklyAnswerIdUnRegisted,
          _newCorrectlyAnswerIdRegisted:
            pending.delta.newCorrectlyAnswerIdRegisted,
          weaklyAnswerIdList: testIdList.weakPoint.total,
          startAt: record.startAt,
          syncContext: {
            source: 'pending',
            dailyLogId: pending.target.dailyLogId,
            base: pending.base,
            playRecord: pending.delta.playRecord,
          },
        });
        if (result.status === 'success' || result.status === 'discarded') {
          await deletePendingDailyLog(createPendingStorageId(pending));
        }
      }
    } catch (error) {
      // 失敗した保留データ以降は順序を守るため次回へ持ち越す。
      console.error('保留デイリーログの適用に失敗しました', error);
    }
  }, [
    props.grade,
    props.loginUser,
    testIdList,
    isWeakPointDataReady,
    loadLegacyPendingDailyLog,
    savePendingDailyLog,
    deleteLegacyPendingDailyLog,
    listPendingDailyLogs,
    deletePendingDailyLog,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (currentDailyLog) {
      console.log('current testIdList更新');
      if (testIdList.answered.current !== currentDailyLog.answerIdList)
        setCurrentAnsweredTestIdList(currentDailyLog.answerIdList);
      if (
        testIdList.correctlyAnswered.current !==
        currentDailyLog.newCorrectlyAnswerIdRegisted
      )
        setCurrentCorrectlyAnsweredIdList(
          currentDailyLog.newCorrectlyAnswerIdRegisted,
        );
      if (
        testIdList.weakPoint.current !==
        currentDailyLog.newWeaklyAnswerIdRegisted
      )
        setCurrentWeakPointTestIdList(
          currentDailyLog.newWeaklyAnswerIdRegisted,
          currentDailyLog.newWeaklyAnswerIdUnRegisted,
        );
    }
  }, [currentDailyLog]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const userLogData: UseDailyLogData = useMemo(() => {
    return {
      oldDailyLogStore,
      currentDailyLog,
      setCurrentDailyLog,
      testIdList,
      startCurrentDailyLogConnect,
      initialDailyLog,
      setOldTestIdList,
      dailyDataUnsubscribe,
      setDailyDataUnsubscribe,
      applyPendingDailyLog,
      getPendingBase,
    };
  }, [
    oldDailyLogStore,
    currentDailyLog,
    testIdList,
    startCurrentDailyLogConnect,
    setOldTestIdList,
    dailyDataUnsubscribe,
    setDailyDataUnsubscribe,
    applyPendingDailyLog,
    getPendingBase,
  ]);
  return userLogData;
};

export default useDailyLog;

import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {getAuth} from '@react-native-firebase/auth';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  doc,
  getDoc,
  getDocs,
  Timestamp,
  collection,
  onSnapshot,
} from '@react-native-firebase/firestore';
import {isEqual} from 'lodash';
import {httpsCallable} from '@react-native-firebase/functions';
import type {GradeCommonType} from '../../types/commonUnionType';
import {db} from '../functionals/realtimeDatabaseController';
import {gradeCommonStates} from '../../types/commonUnionType';
import firestoreController, {
  updateDailyLog,
  getTestData,
  convertTestPlayDataLogToTestPlayData,
  getCurrentTests,
  type CurrentTests,
} from '../functionals/firestoreController';
import {functions} from '../functionals/firebase';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';
import {
  GlobalSaveDataContext,
  type SettingCardDataMap,
  type SettingCardData,
  type TestData,
} from './useGlobalSaveDataContext';
import {StorageContext} from './useAsyncStorageContext';
import {AuthContext} from './useAuthContext';
import {pendingDailyLogDataKey} from './useAsyncStorageContext';
import {
  ref,
  onChildChanged,
  off,
  onValue,
} from '@react-native-firebase/database';

type Unsubscribe = () => void;
type AnalysisData = {
  answered: string[];
  correctlyAnswered: string[];
  weaklyAnswered: string[];
  totalPlayTime: number;
};
type PersonalAnalysis = {
  [key in GradeCommonType]: AnalysisData;
};
type OtherAnalysisData = {
  playTime: {
    _total: number;
  };
  testData: {
    execute: object;
    completed: object;
    changelog: object;
  };
};

type UserData = {
  createdAt: FirebaseFirestoreTypes.Timestamp;
  name: string;
  personalAnalysis: PersonalAnalysis & OtherAnalysisData;
};
type SnapshotListener = () => Promise<'success' | 'failed' | 'error'>;

type SnapshotManagerContextType = {
  hasSnapshot: boolean;
  userSnapshotListenSetUp: SnapshotListener;
  clearAllListener: () => void;
  isClearedListeners: boolean;
};

export const SnapshotManagerContext = createContext<SnapshotManagerContextType>(
  {} as SnapshotManagerContextType,
);

type SnapshotManagerProviderProps = {
  readonly children: React.ReactNode;
};

const connectedRef = ref(db, '.info/connected');

const SnapshotManagerProvider = (props: SnapshotManagerProviderProps) => {
  // context
  const {isAuthenticated, loginUser} = useContext(AuthContext);
  const {getDailyLogData, deleteData} = useContext(StorageContext);

  const {
    grade,
    gradeNumber,
    setIsMaintenance,
    setIsOffline,
    setMode,
    setOldTestIdList,
    setIsReloadRequired,
    firstGradeLastUpdate,
    setFirstGradeLastUpdate,
    secondGradeLastUpdate,
    setSecondGradeLastUpdate,
    testIdList,
    setUserData,
    startCurrentDailyLogConnect,
    dailyDataUnsubscribe,
    setDailyDataUnsubscribe,
  } = useContext(GlobalUserSettingContext);
  const {
    answerlingTestSettingData,
    setAnswerlingTestSettingData,
    oldLocalTempSavedSettingList,
    savedSettingList,
    setSavedSettingList,
    getTestDataList,
    setTestDataList,
    setOldLocalTempSavedSettingList,
  } = useContext(GlobalSaveDataContext);

  // state
  const [metaDataUnsubscribe, setMetaDataUnsubscribe] = useState<
    Unsubscribe[] | null
  >(null);
  const [userDataUnsubscribe, setUserDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  /* const [dailyDataUnsubscribe, setDailyDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
    */
  const [testDataUnsubscribe, setTestDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  const [taskDataUnsubscribe, setTaskDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  const [testDataListUnsubscribe, setTestDataListUnsubscribe] =
    useState<Unsubscribe | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [isClearedListeners, setIsClearedListeners] = useState(false);

  /** Memo */
  const usersRef = useMemo(() => {
    if (!loginUser?.uid) return null;
    return doc(firestoreController, 'users', loginUser?.uid);
  }, [loginUser]);

  /** Callback */
  // サーバーステータスのリスナー
  const setServerStatusListener: () => Unsubscribe = useCallback(() => {
    const ref = doc(firestoreController, 'app', 'status');
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data();
      if (data && typeof data.isMaintenance === 'boolean') {
        setIsMaintenance(data.isMaintenance);
      }
    };

    // 初回読み込み
    getDoc(ref)
      .then((doc) => {
        callback(doc);
      })
      .catch((error: unknown) => {
        console.error('get server status error', error);
      });

    return onSnapshot(
      ref,
      (doc) => {
        const data = doc.data();
        if (data && typeof data.isMaintenance === 'boolean') {
          setIsMaintenance(data.isMaintenance);
        }
      },
      (error: unknown) => {
        console.error('firestore error', error);
      },
    );
  }, [setIsMaintenance]);
  // 固有ユーザー情報のリスナー
  const setUserDataListener: () => Unsubscribe | null = useCallback(() => {
    if (!usersRef || !grade) return null;
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      try {
        const data = doc.data();
        if (data) {
          if (data) {
            // ユーザーデータの更新
            const userData = data as UserData;
            const gradeString =
              grade === '1級'
                ? gradeCommonStates.firstGrade
                : gradeCommonStates.secondGrade;
            const answered = userData.personalAnalysis[gradeString].answered;
            const correctlyAnswered =
              userData.personalAnalysis[gradeString].correctlyAnswered;
            const weakPoint =
              userData.personalAnalysis[gradeString].weaklyAnswered;
            const playTime = userData.personalAnalysis.playTime._total;
            setUserData(userData);
            setOldTestIdList({
              answered,
              correctlyAnswered,
              weakPoint,
              playTime,
            });
          }
        }
      } catch (error) {
        console.error('setUserDataListener error', error);
      }
    };

    // 初回読み込み
    getDoc(usersRef)
      .then((doc) => {
        callback(doc);
      })
      .catch((error: unknown) => {
        console.error('get user data error', error);
      });
    return onSnapshot(
      usersRef,
      (doc) => {
        callback(doc);
      },
      (error) => {
        console.error('setUserDataListener error', error);
      },
    );
  }, [usersRef, grade, setOldTestIdList, setUserData]);
  // 蓄積デイリーログが存在するか確認し、存在する場合は適用
  const _applyPendingDailyLog = useCallback(async () => {
    if (!isAuthenticated || !loginUser || !gradeNumber) return;
    // 蓄積デイリーログデータが存在する場合、今日のデイリーログとして設定update
    const pendingDailyLog = await getDailyLogData(pendingDailyLogDataKey);
    if (pendingDailyLog) {
      // dailyLogDataの最後のplayRecordを取得
      const lastPlayRecord =
        pendingDailyLog.playRecord[Object.keys(pendingDailyLog.playRecord)[0]];

      await updateDailyLog({
        gradeNumber,
        _answerList: pendingDailyLog.answerList,
        _answerIdList: pendingDailyLog.answerIdList,
        _correctAnswerList: pendingDailyLog.correctAnswerList,
        _newWeaklyAnswerIdRegisted: pendingDailyLog.newWeaklyAnswerIdRegisted,
        _newWeaklyAnswerIdUnRegisted:
          pendingDailyLog.newWeaklyAnswerIdUnRegisted,
        _newCorrectlyAnswerIdRegisted:
          pendingDailyLog.newCorrectlyAnswerIdRegisted,
        weaklyAnswerIdList: testIdList.weakPoint.total,
        startAt: lastPlayRecord.startAt ?? Timestamp.fromMillis(0),
      });
      // 蓄積デイリーログデータを削除
      deleteData(pendingDailyLogDataKey)
        .then(() => {})
        .catch((error: unknown) => {
          console.error('蓄積デイリーログデータの削除に失敗しました', error);
        });
    }
  }, [
    isAuthenticated,
    loginUser,
    gradeNumber,
    getDailyLogData,
    deleteData,
    testIdList,
  ]);

  // 一級データの更新情報リスナー
  const setFirstGradeInfoListener: () => Unsubscribe = useCallback(() => {
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data();
      if (data?.assets && data?.html && data?.test) {
        console.log('setFirstGradeLastUpdate');
        setFirstGradeLastUpdate({
          assets: data.assets as FirebaseFirestoreTypes.Timestamp,
          html: data.html as FirebaseFirestoreTypes.Timestamp,
          test: data.test as FirebaseFirestoreTypes.Timestamp,
        });
      }
    };

    const ref = doc(firestoreController, 'metadata', 'firstGradeLastUpdate');
    // 初回読み込み
    getDoc(ref)
      .then((doc) => {
        console.log(
          'get first firstGradeLastUpdate',
          summarizeConsoleValue(doc.data()),
        );
        callback(doc);
      })
      .catch((error: unknown) => {
        console.error('get firstGradeLastUpdate error', error);
      });

    return onSnapshot(
      ref,
      (doc) => {
        console.log(
          'get firstGradeLastUpdate',
          summarizeConsoleValue(doc.data()),
        );
        callback(doc);
      },
      (error: unknown) => {
        console.error('get firstGradeLastUpdate error', error);
      },
    );
  }, [setFirstGradeLastUpdate]);
  // 二級データの更新情報リスナー
  const setSecondGradeInfoListener: () => Unsubscribe = useCallback(() => {
    const ref = doc(firestoreController, 'metadata', 'secondGradeLastUpdate');
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data();
      if (data?.assets && data?.html && data?.test) {
        console.log('setSecondGradeLastUpdate');
        setSecondGradeLastUpdate({
          assets: data.assets as FirebaseFirestoreTypes.Timestamp,
          html: data.html as FirebaseFirestoreTypes.Timestamp,
          test: data.test as FirebaseFirestoreTypes.Timestamp,
        });
      }
    };

    // 初回読み込み
    getDoc(ref)
      .then((doc) => {
        console.log(
          'get second secondGradeLastUpdate',
          summarizeConsoleValue(doc.data()),
        );
        callback(doc);
      })
      .catch((error: unknown) => {
        console.error('get secondGradeLastUpdate error', error);
      });
    return onSnapshot(ref, (doc) => {
      console.log(
        'get secondGradeLastUpdate',
        summarizeConsoleValue(doc.data()),
      );
      callback(doc);
    });
  }, [setSecondGradeLastUpdate]);

  // メンテナンスモード情報のリスナー
  const setModeInfoListener: () => Unsubscribe = useCallback(() => {
    const ref = doc(firestoreController, 'metadata', 'mode');
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data();
      if (data?.isMaintenance) {
        setMode({
          isMaintenance: data.isMaintenance as boolean,
        });
      }
    };

    // 初回読み込み
    getDoc(ref)
      .then((docSnap) => {
        callback(docSnap);
      })
      .catch((error: unknown) => {
        console.error('get mode error', error);
      });

    return onSnapshot(ref, (doc) => {
      const data = doc.data();
      if (data?.isMaintenance) {
        setMode({
          isMaintenance: data.isMaintenance as boolean,
        });
      }
    });
  }, [setMode]);
  // タスクデータの情報取得リスナー
  const taskDataListener: () => Unsubscribe | null = useCallback(() => {
    if (!isAuthenticated || !loginUser) return null;

    const taskDataRef = collection(
      firestoreController,
      'users',
      loginUser.uid,
      'tasks',
    ) as FirebaseFirestoreTypes.CollectionReference<SettingCardData>;
    const callback = (
      snapshot: FirebaseFirestoreTypes.QuerySnapshot<SettingCardData>,
    ) => {
      // oldLocalTempSavedSettingListが存在している場合
      // この条件は、①以前にaddSavedSettingListでローカルで保存されていてこの端末上ではfirestoreに保存されたことが確認されていない場合と
      // ② firestore上でのsavedSettingListの保存を行う前のバージョンからアップデートされた初回起動時の場合
      // この二つの条件を想定した処理
      const oldLocalTempSavedSettingListKeys = Object.keys(
        oldLocalTempSavedSettingList ?? {},
      );
      if (
        oldLocalTempSavedSettingList !== null &&
        oldLocalTempSavedSettingListKeys.length > 0 &&
        oldLocalTempSavedSettingList[oldLocalTempSavedSettingListKeys[0]]
          .grade &&
        oldLocalTempSavedSettingList[oldLocalTempSavedSettingListKeys[0]]
          .grade === grade
      ) {
        const docs =
          snapshot.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[];
        const snapshotKeys = new Set(
          docs.map((doc) => {
            const data = doc.data() as SettingCardData;
            return data.id;
          }),
        );
        const newSettingListKeys = [];
        const deleteLocalTempSavedSettingKeys: string[] = [];
        for (const key of oldLocalTempSavedSettingListKeys) {
          // oldLocalTempSavedSettingListにだけ存在しているデータがあれば追加
          if (snapshotKeys.has(key)) {
            const doc = docs.find((doc) => doc.data().id === key);
            const docData = doc?.data() as SettingCardData;
            // 両方に存在していて、oldLocalTempSavedSettingListのデータのupdateAtが新しい場合、更新
            // 条件A: oldLocalTempSavedSettingList[key]のupdateAtがundefinedでかつdocDataのupdateAtがundefinedでない場合
            const conditionA =
              oldLocalTempSavedSettingList[key].updatedAt === undefined &&
              docData.updatedAt !== undefined;
            // 条件B: docDataがundefinedでなく、oldLocalTempSavedSettingList[key]のupdateAtがdocDataのupdateAtより新しい場合
            const oldUpdateAt = oldLocalTempSavedSettingList[key]?.updatedAt;
            const conditionB =
              doc !== undefined &&
              docData.updatedAt !== undefined &&
              oldUpdateAt &&
              oldUpdateAt.toMillis() > docData.updatedAt.toMillis();
            if (conditionA || conditionB) {
              // 更新
              newSettingListKeys.push(key);
            } else {
              // 両方に存在していて、snapshotのデータと更新時間が同じまたは新しい場合はoldLocalTempSavedSettingListのデータを削除
              deleteLocalTempSavedSettingKeys.push(key);
            }
          } else {
            // 追加
            newSettingListKeys.push(key);
          }
        }

        // 削除するLocalKeyがあれば削除
        if (deleteLocalTempSavedSettingKeys.length > 0) {
          const newLocalTempSavedSettingList = Object.keys(
            oldLocalTempSavedSettingList,
          ).reduce<SettingCardDataMap>((acc, key) => {
            if (!deleteLocalTempSavedSettingKeys.includes(key)) {
              acc[key] = oldLocalTempSavedSettingList[key];
            }

            return acc;
          }, {});

          setOldLocalTempSavedSettingList(newLocalTempSavedSettingList);
        }

        // 更新するSettingListがあれば更新
        if (newSettingListKeys.length > 0) {
          const newSettingList = newSettingListKeys.reduce<SettingCardDataMap>(
            (acc, key) => {
              acc[key] = oldLocalTempSavedSettingList[key];
              return acc;
            },
            {},
          );
          setSavedSettingList({
            ...savedSettingList,
            ...newSettingList,
          }).catch((error: unknown) => {
            console.error('setSavedSettingList error', error);
          });
        }
      } else {
        // snapshotのデータをそのままsavedSettingListに同期

        const docs =
          snapshot.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[];
        const newSettingList = docs.reduce<SettingCardDataMap>((acc, doc) => {
          const data = doc.data();
          // バリデーションチェック
          if (!data) return acc;
          if (!data.id) return acc;
          if (!data.updatedAt) return acc; // snapshot上のデータは必ずupdateAtが付与されているはずなので
          if (!(data.updatedAt instanceof Timestamp)) return acc;
          if (data.grade !== grade) return acc;

          acc[doc.id] = doc.data() as SettingCardData;
          return acc;
        }, {});
        setSavedSettingList(newSettingList).catch((error: unknown) => {
          console.error('setSavedSettingList error', error);
        });
      }
    };

    // 初回読み込み
    getDocs(taskDataRef)
      .then((snapshot) => {
        callback(snapshot);
      })
      .catch((error: unknown) => {
        console.error('get taskData error', error);
      });

    return onSnapshot(
      taskDataRef,

      (snapshot) => {
        callback(
          snapshot as FirebaseFirestoreTypes.QuerySnapshot<SettingCardData>,
        );
      },
      (error: unknown) => {
        console.error('taskDataListener error', error);
      },
    );
  }, [
    grade,
    isAuthenticated,
    loginUser,
    savedSettingList,
    oldLocalTempSavedSettingList,
    setSavedSettingList,
    setOldLocalTempSavedSettingList,
  ]);
  const getTestDataProcess = useCallback(
    async (id: string) => {
      const data = await getTestData(id).catch((error: unknown) => {
        console.error('getTestData error', error);
        return null;
      });
      if (data?.testPlayDataLog) {
        const testPlayData = convertTestPlayDataLogToTestPlayData(
          data.testPlayDataLog,
        );

        if (!isEqual(answerlingTestSettingData, testPlayData)) {
          await setAnswerlingTestSettingData(testPlayData).catch(
            (error: unknown) => {
              console.error('setAnswerlingTestSettingData error', error);
            },
          );
        }
      } else {
        await setAnswerlingTestSettingData(null);
      }
    },
    [setAnswerlingTestSettingData, answerlingTestSettingData],
  );
  const subscribeCurrentTestCallback = useCallback(
    (data: CurrentTests) => {
      if (!data?._inter0?.id) return;
      if (data._inter0.id) {
        const currentTestId = data._inter0.id;
        if (!answerlingTestSettingData) {
          getTestDataProcess(currentTestId).catch((error: unknown) => {
            console.error('getTestDataProcess error', error);
            setIsReloadRequired(true);
          });
          return;
        }

        if (answerlingTestSettingData.testId === currentTestId) return;
        setIsReloadRequired(true);
      }
    },
    [answerlingTestSettingData, getTestDataProcess, setIsReloadRequired],
  );
  // 現在のテストデータの監視
  const currentTestListener: () => Unsubscribe | null = useCallback(() => {
    const uid = getAuth(firestoreController.app).currentUser?.uid;
    if (!uid) return null;
    //    const currentTestsRef = ;
    const callback = (doc: FirebaseFirestoreTypes.DocumentSnapshot) => {
      const data = doc.data();
      if (data) {
        subscribeCurrentTestCallback(data as CurrentTests);
      }
    };

    const currentTestsRef = doc(
      firestoreController,
      'users',
      uid,
      'shared',
      'currentTests',
    );
    // 初回読み込み
    getDoc(currentTestsRef)
      .then((docSnap) => {
        callback(docSnap);
      })
      .catch((error: unknown) => {
        console.error('get currentTests error', error);
      });

    // リアルタイムの変更監視
    return onSnapshot(
      currentTestsRef,
      (docSnap) => {
        callback(docSnap);
      },
      (error) => {
        console.error('currentTestsListener error', error);
      },
    );
  }, [subscribeCurrentTestCallback]);
  // テストデータリストの監視
  const testDataListListener: () => Unsubscribe = useCallback(() => {
    const commonGrade =
      grade === '1級'
        ? gradeCommonStates.firstGrade
        : gradeCommonStates.secondGrade;
    const path = `test/${commonGrade}/`;

    const sub = onChildChanged(ref(db, path), (snapshot) => {
      const testDataList = getTestDataList(false);
      const newTestData: TestData = snapshot.val() as TestData;
      setTestDataList(
        testDataList.splice(newTestData.no - 1, 0, newTestData),
      ).catch((error: unknown) => {
        console.error('sub：処理失敗', error);
      });
    });
    return () => off(ref(db, path), 'child_changed', sub);
  }, [grade, getTestDataList, setTestDataList]);

  // ユーザーデータの監視開始
  const userDataListenSetUp: SnapshotListener = useCallback(async () => {
    try {
      if (isAuthenticated && loginUser) {
        // 固有のuserデータが存在するか確認
        const authUser = await getDoc(
          doc(firestoreController, 'users', loginUser?.uid),
        ).catch((error: unknown) => {
          console.error('firestore error', error);
          throw new Error('firestore error');
        });
        const userData = authUser.data();
        if (
          authUser.exists() &&
          userData?.personalAnalysis &&
          userData?.name &&
          userData?.createdAt
        ) {
        } else {
          // 存在しない場合は作成
          await httpsCallable(
            functions,
            'updateUserDataByAdmin',
          )({
            uid: loginUser?.uid,
            userData: {name: loginUser?.displayName},
          }).catch((error: unknown) => {
            console.error('updateUserDataByAdmin error', error);
            throw new Error('updateUserDataByAdmin error');
          });
        }

        const userDataUnsub = setUserDataListener();

        setUserDataUnsubscribe(() => userDataUnsub);
        return 'success';
      } else if (userDataUnsubscribe !== null) {
        userDataUnsubscribe();
        setUserDataUnsubscribe(null);
      }

      return 'failed';
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('userDataListenSetUp：処理失敗', error);
      }

      return 'error';
    }
  }, [loginUser, isAuthenticated, setUserDataListener, userDataUnsubscribe]);

  // メタデータの監視開始
  const metaDataListenSetUp: SnapshotListener = useCallback(async () => {
    if (!metaDataUnsubscribe && isAuthenticated) {
      try {
        console.info('MetaData スナップショット登録開始');
        const firstUnsubscriber = setFirstGradeInfoListener();
        const secondUnsubscriber = setSecondGradeInfoListener();
        const modeUnsubscriber = setModeInfoListener();

        setMetaDataUnsubscribe([
          firstUnsubscriber,
          secondUnsubscriber,
          modeUnsubscriber,
        ]);
        return 'success';
      } catch (error: unknown) {
        console.error('[firestore connection error]', error);
        return 'error';
      }
    } else if (metaDataUnsubscribe && !isAuthenticated) {
      for (const unsub of metaDataUnsubscribe) {
        unsub();
      }

      setMetaDataUnsubscribe(null);
    }

    return 'failed';
  }, [
    isAuthenticated,
    metaDataUnsubscribe,
    setFirstGradeInfoListener,
    setSecondGradeInfoListener,
    setModeInfoListener,
  ]);
  // デイリーログの監視開始
  // 現在のテストデータの監視開始
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const currentTestsListenSetUp: SnapshotListener = useCallback(async () => {
    try {
      if (isAuthenticated && grade && loginUser?.uid) {
        // テストデータの初期設定
        const {status, currentTests, errorMessage} = await getCurrentTests();

        if (
          status === 'success' &&
          currentTests?._inter0 !== undefined &&
          currentTests._inter0.id !== ''
        ) {
          console.log(
            '⭐️テストデータ取得成功',
            summarizeConsoleValue(currentTests),
          );
          getTestDataProcess(currentTests._inter0.id).catch(
            (error: unknown) => {
              console.error('getTestDataProcess error', error);
            },
          );
        } else if (errorMessage) {
          console.error('getCurrentTests error', currentTests, errorMessage);
        } else {
        }

        // テストデータの監視
        const Unsubscribe = currentTestListener();
        setTestDataUnsubscribe(() => Unsubscribe);
        return 'success';
      } else if (testDataUnsubscribe) {
        testDataUnsubscribe();
        setTestDataUnsubscribe(() => null);
      }

      return 'failed';
    } catch (error: unknown) {
      console.error('currentTestListenUp():Error', error);
      return 'error';
    }
  }, [
    isAuthenticated,
    grade,
    loginUser,
    testDataUnsubscribe,
    setTestDataUnsubscribe,
    getTestDataProcess,
    currentTestListener,
  ]);
  // タスクデータの監視開始
  const taskDataListenSetUp: SnapshotListener = useCallback(async () => {
    if (isAuthenticated && loginUser) {
      const taskDataUnsub = taskDataListener();

      setTaskDataUnsubscribe(() => taskDataUnsub);
      return 'success';
    } else if (taskDataUnsubscribe !== null) {
      taskDataUnsubscribe();
      setTaskDataUnsubscribe(null);
    }

    return 'failed';
  }, [isAuthenticated, loginUser, taskDataUnsubscribe, taskDataListener]);
  // テストデータリストの監視開始
  const testDataListListenSetUp: SnapshotListener = useCallback(async () => {
    if (isAuthenticated && loginUser) {
      const testDataListUnSub = testDataListListener();

      setTestDataListUnsubscribe(() => testDataListUnSub);
      return 'success';
    } else if (testDataListUnsubscribe !== null) {
      testDataListUnsubscribe();
      setTestDataListUnsubscribe(null);
    }

    return 'failed';
  }, [
    isAuthenticated,
    loginUser,
    testDataListListener,
    testDataListUnsubscribe,
  ]);

  /** 全てのリスナーを登録解除する */
  const clearAllListener = useCallback(() => {
    if (metaDataUnsubscribe) {
      for (const unsub of metaDataUnsubscribe) {
        unsub();
      }
    }

    if (userDataUnsubscribe) {
      userDataUnsubscribe();
    }

    if (dailyDataUnsubscribe) {
      dailyDataUnsubscribe();
    }

    if (testDataUnsubscribe) {
      testDataUnsubscribe();
    }

    if (taskDataUnsubscribe) {
      taskDataUnsubscribe();
    }

    setMetaDataUnsubscribe(null);
    setUserDataUnsubscribe(null);
    setDailyDataUnsubscribe(null);
    setTestDataUnsubscribe(null);
    setTaskDataUnsubscribe(null);
  }, [
    taskDataUnsubscribe,
    metaDataUnsubscribe,
    userDataUnsubscribe,
    dailyDataUnsubscribe,
    testDataUnsubscribe,
    setDailyDataUnsubscribe,
  ]);
  // ユーザーデータ認証後のリスナー一括監視
  const userSnapshotListenSetUp: SnapshotListener = useCallback(async () => {
    try {
      if (isAuthenticated && loginUser !== null) {
        const promises = [];
        if (!metaDataUnsubscribe) promises.push(metaDataListenSetUp());
        if (!userDataUnsubscribe) promises.push(userDataListenSetUp());
        if (!dailyDataUnsubscribe) promises.push(startCurrentDailyLogConnect());
        if (!testDataUnsubscribe) promises.push(currentTestsListenSetUp());
        if (!taskDataUnsubscribe) promises.push(taskDataListenSetUp());
        if (!testDataListUnsubscribe) promises.push(testDataListListenSetUp());
        if (promises.length > 0)
          return await Promise.all(promises).then((results) => {
            console.info(
              'スナップショット取得結果',
              summarizeConsoleValue(results),
            );
            if (results.every((v) => v === 'success')) {
              setHasSnapshot(true);
              return 'success';
            }

            return 'failed';
          });
        console.warn('スナップショットが全て登録済みです');
        clearAllListener();
        return 'failed';
      } else {
        if (metaDataUnsubscribe) {
          for (const unsub of metaDataUnsubscribe) {
            unsub();
          }

          setMetaDataUnsubscribe(null);
        }

        if (userDataUnsubscribe) {
          userDataUnsubscribe();
          setUserDataUnsubscribe(null);
        }

        if (dailyDataUnsubscribe) {
          dailyDataUnsubscribe();
          setDailyDataUnsubscribe(null);
        }

        if (testDataUnsubscribe) {
          testDataUnsubscribe();
          setTestDataUnsubscribe(null);
        }

        if (taskDataUnsubscribe) {
          taskDataUnsubscribe();
          setTaskDataUnsubscribe(null);
        }

        console.error(
          'スナップショット取得失敗',
          summarizeConsoleValue(isAuthenticated),
        );
        setHasSnapshot(false);
        return 'failed';
      }
    } catch (error: unknown) {
      console.error('userSnapshotListenSetUp error', error);
      throw new Error('userSnapshotListenSetUp error');
    }
  }, [
    isAuthenticated,
    loginUser,
    metaDataListenSetUp,
    metaDataUnsubscribe,
    userDataListenSetUp,
    userDataUnsubscribe,
    startCurrentDailyLogConnect,
    dailyDataUnsubscribe,
    currentTestsListenSetUp,
    testDataUnsubscribe,
    taskDataListenSetUp,
    taskDataUnsubscribe,
    setDailyDataUnsubscribe,
    clearAllListener,
    testDataListListenSetUp,
    testDataListUnsubscribe,
  ]);

  // 起動時処理
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // サーバー状態の監視
    setServerStatusListener();
    // オンライン状態監視
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setIsOffline(false);
      } else {
        setIsOffline(true);
      }
    });
  }, []);

  // 各スナップショットデータ接続確認
  // スナップショットデータ:
  // [MetaData]
  // 1. firstGradeLastUpdate
  // 2. secondGradeLastUpdate
  // 3. mode
  // [UserData]
  // [DailyLog]
  // [TestData]

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (
      firstGradeLastUpdate &&
      secondGradeLastUpdate &&
      metaDataUnsubscribe &&
      metaDataUnsubscribe.length === 3 &&
      userDataUnsubscribe &&
      dailyDataUnsubscribe &&
      taskDataUnsubscribe &&
      testDataUnsubscribe
    ) {
      setHasSnapshot(true);
    } else {
      // リスナーが全て登録されていないでかつ認証済みの場合、ログアウト
      if (
        !metaDataUnsubscribe &&
        !userDataUnsubscribe &&
        !dailyDataUnsubscribe &&
        !testDataUnsubscribe &&
        !taskDataUnsubscribe
      ) {
        setIsClearedListeners(true);
      } else {
        setIsClearedListeners(false);
      }

      setHasSnapshot(false);
    }
  }, [
    firstGradeLastUpdate,
    secondGradeLastUpdate,
    metaDataUnsubscribe,
    userDataUnsubscribe,
    dailyDataUnsubscribe,
    testDataUnsubscribe,
  ]);

  // 認証後リスナー登録
  /*
  useEffect(() => {
    console.log('hoge', isOffline, grade, loginUser, isAuthenticated);
    if (!grade) return;
    if (!loginUser) return;
    if (!isAuthenticated) return;
    metaDataListenSetUp().catch((error: unknown) => {
      console.log('メタデータ監視失敗', error);
    });
    userDataListenSetUp().catch((error: unknown) => {
      console.log('ユーザーデータ監視失敗', error);
    });
    dailyLogListenSetUp().catch((error: unknown) => {
      console.log('デイリーログ監視失敗', error);
    });
  }, [grade, loginUser]);
*/
  const contextValue: SnapshotManagerContextType = useMemo(
    () => ({
      hasSnapshot,
      userSnapshotListenSetUp,
      clearAllListener,
      isClearedListeners,
    }),
    [
      hasSnapshot,
      userSnapshotListenSetUp,
      clearAllListener,
      isClearedListeners,
    ],
  );

  return (
    <SnapshotManagerContext.Provider value={contextValue}>
      {props.children}
    </SnapshotManagerContext.Provider>
  );
};

export default SnapshotManagerProvider;

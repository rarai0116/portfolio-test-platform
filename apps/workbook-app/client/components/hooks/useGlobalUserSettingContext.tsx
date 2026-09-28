import {summarizeConsoleValue} from '../functionals/consoleLevels';
import type React from 'react';
import {
  useState,
  useCallback,
  useContext,
  createContext,
  useMemo,
  useRef,
} from 'react';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  questionGrade,
  type GradeCommonType,
  type GradeNumber,
  type QuestionGradeType,
} from '../../types/commonUnionType';
import {AuthContext} from './useAuthContext';
import type {TestData, TestPlayData} from './useGlobalSaveDataContext';
import {StorageContext} from './useAsyncStorageContext';
import useDailyLog, {type UseDailyLogData} from './useDailyLogData';
/** Defined Type */
export type GradeLastUpdate = {
  assets: FirebaseFirestoreTypes.Timestamp;
  html: FirebaseFirestoreTypes.Timestamp;
  test: FirebaseFirestoreTypes.Timestamp;
};

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
  /*
  weakPointOrUnAnsweredTest: {
    current: string[];
    old: string[];
    total: string[];
  };
  */
  generate: (data: TestData, isQaa: boolean) => string;
};
type GlobalUserSettingContextObject = {
  firstGradeLastUpdate: GradeLastUpdate | null;
  setFirstGradeLastUpdate: React.Dispatch<
    React.SetStateAction<GradeLastUpdate | null>
  >;
  secondGradeLastUpdate: GradeLastUpdate | null;
  setSecondGradeLastUpdate: React.Dispatch<
    React.SetStateAction<GradeLastUpdate | null>
  >;
  mode: {
    isMaintenance: boolean;
  };
  setMode: React.Dispatch<React.SetStateAction<{isMaintenance: boolean}>>;
  isChacheCleared: boolean;
  setIsChacheCleared: React.Dispatch<React.SetStateAction<boolean>>;
  isOffline: boolean;
  setIsOffline: React.Dispatch<React.SetStateAction<boolean>>;
  grade: QuestionGradeType | undefined;
  gradeNumber: GradeNumber | null;
  setGrade: (grade?: QuestionGradeType) => void;
  userData: UserData | null;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  isZipDownloadRequired: boolean;
  setIsZipDownloadRequired: React.Dispatch<React.SetStateAction<boolean>>;
  isMaintenance: boolean;
  setIsMaintenance: React.Dispatch<React.SetStateAction<boolean>>;
  currentPlayData: TestPlayData | null;
  setCurrentPlayData: React.Dispatch<React.SetStateAction<TestPlayData | null>>;
  // isAnswerShowed: boolean;
  // setIsAnswerShowed: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isReloadRequired: boolean;
  setIsReloadRequired: React.Dispatch<React.SetStateAction<boolean>>;
  currentRecordKey: string | null;
  setCurrentRecordKey: React.Dispatch<React.SetStateAction<string | null>>;
  readyForTest: {
    isApp: boolean;
    setIsApp: React.Dispatch<React.SetStateAction<boolean>>;
    isUser: boolean;
    setIsUser: React.Dispatch<React.SetStateAction<boolean>>;
    isComplete: boolean;
    initialize(): void;
  };
  isDisabledInput: boolean;
  setIsDisabledInput: (
    value: boolean,
    callBack?: () => Promise<void>,
  ) => Promise<void>;
  //  isModalVisible: boolean;
  //  setIsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  //  isModalLikeViewVisible: boolean;
  // setIsModalLikeViewVisible: React.Dispatch<React.SetStateAction<boolean>>;
  isModalVisibleRef: React.RefObject<boolean>;
  isModalLikeViewVisibleRef: React.RefObject<boolean>;
  showedTodayTaskModalDate: string | null;
  setShowedTodayTaskModalDate: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  globalTimerId: ReturnType<typeof setTimeout> | undefined;
  setGlobalTimerId: React.Dispatch<
    React.SetStateAction<ReturnType<typeof setTimeout> | undefined>
  >;
} & UseDailyLogData;

type AnalysisData = {
  answered: string[];
  correctlyAnswered: string[];
  weaklyAnswered: string[];
  totalPlayTime: number;
};
type PersonalAnalysis = Record<GradeCommonType, AnalysisData>;
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

type Unsubscribe = () => void;

type Props = {
  readonly children: React.ReactNode;
};

export const GlobalUserSettingContext =
  createContext<GlobalUserSettingContextObject>(
    {} as GlobalUserSettingContextObject,
  );

export const GlobalUserSettingContextProvider = (props: Props) => {
  /** Load Contexts */
  const {loginUser, isAuthenticated} = useContext(AuthContext);
  const {
    getDailyLogData: _getDailyLogData,
    setDailyLogData: _setDailyLogData,
    deleteData: _deleteData,
  } = useContext(StorageContext);
  /** Defined States */
  const [firstGradeLastUpdate, setFirstGradeLastUpdate] =
    useState<GradeLastUpdate | null>(null);
  const [secondGradeLastUpdate, setSecondGradeLastUpdate] =
    useState<GradeLastUpdate | null>(null);
  const [mode, setMode] = useState({
    isMaintenance: false,
  });
  const [isChacheCleared, setIsChacheCleared] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  // テストデータの同期処理を行ったか
  const [_isSyncedTestData, _setIsSyncedTestData] = useState(false);
  const [_metaDataUnsubscribe, _setMetaDataUnsubscribe] = useState<
    Unsubscribe[] | null
  >(null);
  const [_userDataUnsubscribe, _setUserDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  useState<Unsubscribe | null>(null);
  const [_testDataUnsubscribe, _setTestDataUnsubscribe] =
    useState<Unsubscribe | null>(null);
  const [_hasSnapshot, _setHasSnapshot] = useState(false);
  const [grade, _setGrade] = useState<QuestionGradeType | undefined>(undefined);
  const [gradeNumber, setGradeNumber] = useState<GradeNumber | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isZipDownloadRequired, setIsZipDownloadRequired] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  // 解説表示中か
  // const [isAnswerShowed, setIsAnswerShowed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // リロード要求
  const [isReloadRequired, setIsReloadRequired] = useState(false);
  // テスト開始準備完了(アプリ側)
  const [isReadyForTest, setIsReadyForTest] = useState(false);
  // テスト開始操作(ユーザー側)
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [isDisabledInput, _setIsDisabledInput] = useState(false);
  // useRefでisDisabledInputを管理する
  // const _isDisabledInput = useRef(false);
  // const isDisabledInput = _isDisabledInput.current;
  const setIsDisabledInput = useCallback(
    async (value: boolean, callBack?: () => Promise<void>): Promise<void> => {
      _setIsDisabledInput(value);

      return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!callBack) {
              resolve();
              return;
            }

            callBack()
              .then(resolve)
              .catch((error: unknown) => {
                console.error('Error in setIsDisabledInput callback:', error);
                reject(
                  new Error(`setIsDisabledInput callback failed: ${error}`),
                );
              });
          }, 100);
        });
      });
    },
    [],
  );

  const [currentPlayData, setCurrentPlayData] = useState<TestPlayData | null>(
    null,
  );
  // モーダル表示中か
  // const [isModalVisible, setIsModalVisible] = useState(false);
  const isModalVisibleRef = useRef(false);
  // モーダルライクビュー表示中か
  // const [isModalLikeViewVisible, setIsModalLikeViewVisible] = useState(false);
  const isModalLikeViewVisibleRef = useRef(false);

  // 今日の課題モーダルを表示した時の日付
  const [showedTodayTaskModalDate, setShowedTodayTaskModalDate] = useState<
    string | null
  >(null);

  const [globalTimerId, setGlobalTimerId] = useState<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const dailyLogValues = useDailyLog({
    uid: loginUser?.uid,
    isAuthenticated,
    loginUser,
    grade,
    gradeNumber,
    setIsReloadRequired,
  });

  const readyForTest = useMemo(() => {
    console.info(
      'isReadyForTest',
      summarizeConsoleValue(isReadyForTest),
      'isTestStarted',
      summarizeConsoleValue(isTestStarted),
    );
    return {
      isApp: isReadyForTest,
      setIsApp: setIsReadyForTest,
      isUser: isTestStarted,
      setIsUser: setIsTestStarted,
      isComplete: isReadyForTest && isTestStarted,
      initialize() {
        setIsReadyForTest(false);
        setIsTestStarted(false);
      },
    };
  }, [isReadyForTest, isTestStarted]);

  const [_oldPlayTime, _setOldPlayTime] = useState<number>(0);

  // 現在の記録キー
  const [currentRecordKey, setCurrentRecordKey] = useState<string | null>(null);

  /** Defined Memos */
  /*
  const usersRef = useMemo(() => {
    if (!loginUser?.uid) return null;
    return doc(firestoreController, 'users', loginUser?.uid);
  }, [loginUser]);
  */

  /*
  const gradeNumber: GradeNumber = useMemo(() => {
    if (grade === questionGrade.gradeOne) return 1;
    if (grade === questionGrade.gradeTwo) return 2;
    return 1;
  }, [grade]);
  */

  /** Defined Functions */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setGrade = useCallback(
    (grade?: QuestionGradeType) => {
      _setGrade(grade);
      const _gradeNumber =
        grade === questionGrade.gradeOne
          ? 1
          : questionGrade.gradeTwo
            ? 2
            : null;
      setGradeNumber(_gradeNumber);
    },
    [_setGrade],
  );

  /** Defined Effects */

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      ...dailyLogValues,
      firstGradeLastUpdate,
      setFirstGradeLastUpdate,
      secondGradeLastUpdate,
      setSecondGradeLastUpdate,
      mode,
      setMode,
      isChacheCleared,
      setIsChacheCleared,
      isOffline,
      setIsOffline,
      grade,
      setGrade,
      gradeNumber,
      userData,
      setUserData,
      isZipDownloadRequired,
      setIsZipDownloadRequired,
      isMaintenance,
      setIsMaintenance,
      currentPlayData,
      setCurrentPlayData,
      //      isAnswerShowed,
      //      setIsAnswerShowed,
      isLoading,
      setIsLoading,
      isReloadRequired,
      setIsReloadRequired,
      currentRecordKey,
      setCurrentRecordKey,
      readyForTest,
      isDisabledInput,
      setIsDisabledInput,
      //      isModalVisible,
      //      setIsModalVisible,
      //      isModalLikeViewVisible,
      //      setIsModalLikeViewVisible,
      showedTodayTaskModalDate,
      setShowedTodayTaskModalDate,
      globalTimerId,
      setGlobalTimerId,
      isModalVisibleRef,
      isModalLikeViewVisibleRef,
    };
  }, [
    dailyLogValues,
    firstGradeLastUpdate,
    secondGradeLastUpdate,
    mode,
    isChacheCleared,
    isOffline,
    grade,
    userData,
    gradeNumber,
    isZipDownloadRequired,
    isMaintenance,
    currentPlayData,
    //    isAnswerShowed,
    //    setIsAnswerShowed,
    isLoading,
    //    isModalVisible,
    isReloadRequired,
    currentRecordKey,
    readyForTest,
    isDisabledInput,
    //    isModalLikeViewVisible,
    showedTodayTaskModalDate,
    globalTimerId,
    isModalVisibleRef,
  ]);

  return (
    <GlobalUserSettingContext.Provider value={value}>
      {props.children}
    </GlobalUserSettingContext.Provider>
  );
};

import {summarizeConsoleValue} from '../functionals/consoleLevels';
import React, {
  createContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useContext,
  type ReactNode,
} from 'react';
import Constants from 'expo-constants';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  doc,
  collection,
  setDoc,
  deleteDoc,
} from '@react-native-firebase/firestore';
import {
  type QuestionGradeType,
  type QuestionModeType,
  type QuestionStateType,
  type TaskAuthorType,
  type QuestionSettingStateType,
  type IndividualMessageSenderType,
  type MessageCardStyleType,
  type MessageSenderType,
  type TaskCalendarColor,
  questionMode,
  questionSettingState,
} from '../../types/commonUnionType';
/*
Import {
  interruptedSavedSettingDummyData,
  previousSavedSettingDummyData,
  testDataExample,
  messageDummyData,
} from '../functionals/dummyData';
 */
import _adjustTestData, {getBaseDirectory} from '../functionals/adjusttestData';
import type {AssetList} from '../functionals/realtimeDatabaseController';
import firestoreController, {
  type TestPlayDataLog,
  updateTestData,
  deleteCurrentTests,
  updateCurrentTests,
} from '../functionals/firestoreController';
import {
  getTodayTimestamp,
  getYmdhmsmString,
  now,
} from '../functionals/timeManager';
import {generateTestDataId} from '../functionals/testDataController';
import {logErrorToAnalytics} from '../functionals/analyticsController';
import type {
  ExamQuestionSettingIdList,
  PracticeQuestionSettingIdList,
} from './useQuestionSettingViewContext';
import {StorageContext} from './useAsyncStorageContext';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';
import useUpdateEffect from './useUpdateEffect';
import {AuthContext} from './useAuthContext';
/** Defined Types */
export type TestData = {
  [key: string]: string | number | boolean | undefined;
  active: boolean;
  answer: string;
  answerNumber: string;
  answerText: string;
  answerText1: string;
  answerText2: string;
  answerText3: string;
  answerText4: string;
  answerText5: string;
  bigCategoryTag: string;
  ch1: string;
  ch2: string;
  ch3: string;
  ch4: string;
  ch5: string;
  difficult: string;
  grade: number;
  isConvertibleQaa: boolean;
  isNegativeAnswer: boolean;
  nengo: string;
  no: number;
  parentAnswerHonbun: string;
  parentHonbun: string;
  parentNo: number;
  parentbNo: string;
  smallCategoryTag: string;
  status: string;
  subject: string;
  testNo: string;
  text: string;
  themeTag: string;
  year: string;
  isWeakPoint?: boolean;
  isAnswered?: boolean;
  id?: string;
  parentText?: string; // 親の選択肢問時の問題本文 ※一問一答のみ
  parentAnswerText?: string; // 親の選択肢問時の解説本文 ※一問一答のみ
  parentChoice?: number; // 親の選択肢問時の選択肢番号 ※一問一答のみ
};

// カテゴリー情報
export type CategoryData = Record<string, SubjectData>;
export type SmallCategoryData = number[];
export type BigCategoryData = Record<string, SmallCategoryData>;
export type SubjectData = Record<string, BigCategoryData>;
export const DifficultiesMap = {
  one: '_1',
  two: '_2',
  three: '_3',
  _total: '_total',
} as const;
export type DifficultiesMapValues =
  (typeof DifficultiesMap)[keyof typeof DifficultiesMap];

type CategoryDataLengthDifficult = Record<DifficultiesMapValues, number[]>;
export type CategoryDataLengthCell = {
  [key: string]: CategoryDataLengthDifficult;
  totalList: CategoryDataLengthDifficult;
  weakList: CategoryDataLengthDifficult;
  unansweredList: CategoryDataLengthDifficult;
  answeredList: CategoryDataLengthDifficult;
  weakPointOrUnAnswered: CategoryDataLengthDifficult;
};
export type CategoryDataLengthMap = Record<string, CategoryDataLengthCell>;

// 課題情報
export type TaskSettingType = {
  testId?: string;
  isTeacher: boolean;
  isOpen?: boolean;
  taskState: QuestionStateType;
  author: TaskAuthorType;
  /** 新しいdeadlineDateは基本的に先生からのみ指定される
   * taskDateが設定されず、deadlineDateのみが設定されている場合、カレンダーには
   * [タイトル名]〆切という名前で表示される
   * なおtaskDateもdeadlineDateも設定されていない場合、カレンダーには表示されない
   * (現在の仕様ではどちらもないタスクは想定していない)
   */
  deadlineDate?: FirebaseFirestoreTypes.Timestamp;
  /** 現deadlineDateをtaskDateに変更する
   *  複数日にまたがるタスクは8月版の段階では作らないが、9月以降に実装する
   *  単日のタスクの場合、startAtとendAtはそれぞれ同じ日付の00:00:00.000と23:59:59.999に設定する
   *  なお時間指定は現状実装していないので基本的にstartAtは00:00:00.000、endAtは23:59:59.999に設定する
   */
  taskDate?: Array<{
    startAt: FirebaseFirestoreTypes.Timestamp;
    endAt: FirebaseFirestoreTypes.Timestamp;
  }>;
  isAbleToAnswerAfterDeadline: boolean | undefined; // Falseの場合は解けないようにする
  isExpired: boolean | undefined;
  taskNotification: boolean;
  taskCalendarColor: TaskCalendarColor;
  taskMemo: string;
  hasTask: boolean;
};

export type SettingCardData = {
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | PracticeQuestionSettingIdList
    | ExamQuestionSettingIdList
    | FirebaseFirestoreTypes.Timestamp
    | string[]
    | TaskSettingType;
  // 共通props
  id: string;
  grade: QuestionGradeType;
  title?: string;
  settingState: QuestionSettingStateType;
  questionMode: QuestionModeType; // Taskにも？
  practiceQuestionSetting: PracticeQuestionSettingIdList;
  examQuestionSetting: ExamQuestionSettingIdList;
  isQaa: boolean;
  // Taskのみ
  taskSetting?: TaskSettingType;
  // Savedのみ
  isPreviousSetting?: boolean; // 前回の設定をフラグで管理しようとすると誤作動を起こすのでこのパラメータは保存しないで読み込み時に付与する
  // 選択可能か
  disablePress?: boolean | undefined;
  // 更新時間
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
};

export type TestPlayData = {
  [key: string]:
    | string
    | number[]
    | boolean
    | FirebaseFirestoreTypes.Timestamp
    | number
    | SettingCardData
    | undefined
    | null;
  testId: string; // テストID
  testDataNoList: number[]; // テストデータNoのリスト
  answerList: number[]; // 解答リスト
  baseSeed?: number; // ベースシード
  selectedAnswerList: number[]; // 選択した解答リスト
  currentPlayNo: number; // 現在の問題番号
  isFinished: boolean; // テストが終了したかどうか
  correctAnswerCount: number; // 正解数
  questionCount: number; // 問題数
  durationTime: number; // 経過時間(ms)
  durationTimePerAnswer: number[]; // 解答ごとの経過時間(ms)
  limitTime: number; // 制限時間(ms)
  startAt: FirebaseFirestoreTypes.Timestamp; // 開始時刻
  endAt: FirebaseFirestoreTypes.Timestamp | undefined | null; // 終了時刻
  settingCardData: SettingCardData; // テスト設定情報
};

export type SettingCardDataMap = Record<string, SettingCardData>;

export type MessageCardData = {
  [key: string]:
    | string
    | number
    | boolean
    | FirebaseFirestoreTypes.Timestamp
    | undefined;
  id: string;
  linkedTaskId?: string;
  isOpen: boolean;
  sender: IndividualMessageSenderType;
  senderType: MessageSenderType;
  date: FirebaseFirestoreTypes.Timestamp;
  title: string;
  content: string;
  cardType?: MessageCardStyleType;
};

export type MessageCardDataMap = Record<string, MessageCardData>;

export type AddSaveSettingListProps = {
  title: string;
  questionMode: QuestionModeType;
  practiceQuestionSetting: PracticeQuestionSettingIdList;
  examQuestionSetting: ExamQuestionSettingIdList;
};
type SettingCardIdPrefix = 'saved' | 'previous' | 'task' | 'interrupted';
type SettingCardIdMode = 'practice' | 'exam';

type GlobalSaveDataContextObject = {
  setTestDataList: (list: TestData[]) => Promise<void>;
  adjustTestData: (testDataList: TestData) => Promise<TestData>;
  answerlingTestSettingData: TestPlayData | null;
  setAnswerlingTestSettingData: (data: TestPlayData | null) => Promise<void>;
  updateCategoryData: (list: TestData[]) => CategoryData;
  previousSavedSetting: SettingCardData | null;
  setPreviousSavedSetting: (settings: SettingCardData) => Promise<void>;
  savedSettingList: SettingCardDataMap;
  oldLocalTempSavedSettingList: SettingCardDataMap | null;
  setOldLocalTempSavedSettingList: React.Dispatch<
    React.SetStateAction<SettingCardDataMap | null>
  >;
  setSavedSettingList: (settings: SettingCardDataMap) => Promise<void>;
  addSavedSettingList: (settings: SettingCardData) => Promise<void>;
  removeSavedSettingList: (id: string) => Promise<void>;
  setTargetSavedSettingId: React.Dispatch<React.SetStateAction<string | null>>;
  removeTargetSavedSettingList: () => Promise<void>;
  messageData: MessageCardDataMap;
  setMessageData: React.Dispatch<React.SetStateAction<MessageCardDataMap>>;
  generateSettingCardId: (
    prefix: SettingCardIdPrefix,
    mode: SettingCardIdMode,
    number_: number,
  ) => string;
  getTestDataList: (isQaa: boolean) => TestData[];
  // GetCategoryData: (isQaa: boolean) => CategoryData;
  getCategoryDataLengthMap: (isQaa: boolean) => CategoryDataLengthMap;
  localAssetList: AssetList | null;
  setLocalAssetList: React.Dispatch<React.SetStateAction<AssetList | null>>;
  basisDir: string | null;
  errorMessage: string;
  updateAllDataLengthMap: (parameters: {
    list?: TestData[];
    qaa?: TestData[];
  }) => void;
  categoryDataLengthMap: CategoryDataLengthMap;
  qaaCategoryDataLengthMap: CategoryDataLengthMap;
};
export const answerMarkStates = {
  correct: 'correct',
  wrong: 'wrong',
  none: 'none',
} as const;
export type AnswerMarkStates =
  (typeof answerMarkStates)[keyof typeof answerMarkStates];

type Props = {
  readonly children: ReactNode;
  readonly testDataList?: TestData[];
};

export const GlobalSaveDataContext = createContext<GlobalSaveDataContextObject>(
  {} as GlobalSaveDataContextObject,
);

/** Constants */
const initialCategoryDataLengthDifficult = {
  _total: [],
  _1: [],
  _2: [],
  _3: [],
};

/** Common Functions */
/**
 * 問題データやカテゴリー情報、テスト設定情報などのfirebaseやストレージに保存するデータを管理するコンテキスト
 * @desc 各データはローディング時に自動的に読み込まれ、set関数を用いることでfirebaseおよびストレージと自動的に同期される
 * @param props testDataList: TestData[] 問題データのリスト
 * @param props categoryData: CategoryData カテゴリー情報
 * @param props children
 * @returns
 */
const GlobalSaveDataContextProvider = (props: Props) => {
  const AppEnv = useMemo(
    () => (Constants.expoConfig?.extra?.APP_ENV ?? 'test') as string,
    [],
  );

  /** Load Context */
  const {
    getSettingCardData,
    setSettingCardData,
    setTestPlayData,
    getNumberData,
    setNumberData,
  } = useContext(StorageContext);
  const {loginUser} = useContext(AuthContext);
  const {grade, setCurrentRecordKey, testIdList} = useContext(
    GlobalUserSettingContext,
  );

  /** Defined States */
  // テストデータ
  const [testDataList, _setTestDataList] = useState<TestData[]>(
    props.testDataList ?? [],
  );
  // カテゴリーデータ
  //  const [categoryData, setCategoryData] = useState<CategoryData>({});
  // カテゴリーデータごとの問題数
  const [categoryDataLengthMap, setCategoryDataLengthMap] =
    useState<CategoryDataLengthMap>({});
  // 一問一答テストデータ
  const [qaaTestDataList, setQaaTestDataList] = useState<TestData[]>([]);
  // 一問一答テストデータのカテゴリーデータ
  const [_qaaCategoryData, _setQaaCategoryData] = useState<CategoryData>({});
  // 一問一答テストデータごとの問題数
  const [qaaCategoryDataLengthMap, setQaaCategoryDataLengthMap] =
    useState<CategoryDataLengthMap>({});
  // 回答中のテスト設定データ
  const [answerlingTestSettingData, _setAnswerlingTestSettingData] =
    useState<TestPlayData | null>(null);
  // 保存したテスト設定データリスト
  const [savedSettingList, _setSavedSettingList] = useState<SettingCardDataMap>(
    {},
  );
  // 旧仕様の保存したテスト設定データ(ローカルに保存されているデータの一時保存場所)
  const [
    oldLocalTemporarySavedSettingList,
    setOldLocalTemporarySavedSettingList,
  ] = useState<SettingCardDataMap | null>(null);
  // 直近で保存したテスト設定データidの番号
  const [currentSavedSettingNumber, _setCurrentSavedSettingNumber] =
    useState<number>(0);
  // 対象に選んだテスト設定データID(主に選択したテスト設定データ一つを削除するために使用)
  const [targetSavedSettingId, setTargetSavedSettingId] = useState<
    string | null
  >(null);
  // 前回に回答したテスト設定データ
  const [previousSavedSetting, _setPreviousSavedSetting] =
    useState<SettingCardData | null>(null);
  // メッセージカードデータリスト
  const [messageData, setMessageData] = useState<MessageCardDataMap>({});
  // ローカルのアセットリスト
  const [localAssetList, setLocalAssetList] = useState<AssetList | null>(null);
  const [basisDir, setBasisDir] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const taskDataRef = useMemo(() => {
    if (!loginUser) {
      return null;
    }

    const userDocRef = doc(firestoreController, 'users', loginUser.uid);

    return collection(
      userDocRef,
      'tasks',
    ) as FirebaseFirestoreTypes.CollectionReference;
  }, [loginUser]);
  /** Defined Memo */
  // 基準キャッシュディレクトリパス

  /** Defined Functions */
  // 一問一答テストデータをTestDataListを元に生成
  const updateQaaTestDataList = useCallback((list: TestData[]) => {
    const list2 = list.filter((data) => data.isConvertibleQaa);
    return list2.reduce<TestData[]>((acc, cur, i) => {
      const _array =
        cur.grade === 0 ? Array.from({length: 4}) : Array.from({length: 5});
      const answerCorrectly = cur.isNegativeAnswer ? '2' : '1';
      const unAnswerCorrectly = cur.isNegativeAnswer ? '1' : '2';
      const _list = _array.map((_, i2) => {
        const answer =
          cur.answer === String(i2 + 1) ? answerCorrectly : unAnswerCorrectly;
        const _data = {
          ...cur,
          no: i * (cur.grade + 4) + i2,
          text: cur[`ch${i2 + 1}`] as string,
          answerText: cur[`answerText${i2 + 1}`] as string,
          parentText: cur.text,
          parentAnswerText: cur.answerText,
          parentNo: cur.no,
          parentChoice: i2 + 1,
          answer,
          ch1: '',
          ch2: '',
          ch3: '',
          ch4: '',
          ch5: '',
          answerText1: '',
          answerText2: '',
          answerText3: '',
          answerText4: '',
          answerText5: '',
        };
        return _data;
      });
      acc.push(..._list);
      return acc;
    }, []);
  }, []);

  // テストデータリストに同期してカテゴリーデータを更新(選択肢・一問一答共通)
  const updateCategoryData = useCallback((_list: TestData[]) => {
    // この呼び出し内で新規作成する索引だけを変更し、元の問題データは変更しない。
    const data: CategoryData = {};
    for (const cur of _list) {
      data[cur.subject] ??= {};
      const subjectData = data[cur.subject];
      subjectData[cur.bigCategoryTag] ??= {};
      const bigCategoryData = subjectData[cur.bigCategoryTag];
      bigCategoryData[cur.smallCategoryTag] ??= [];
      const smallCategoryData = bigCategoryData[cur.smallCategoryTag];
      smallCategoryData.push(cur.no);
    }
    return data;
  }, []);

  // CategoryDataLengthMapを更新(選択肢・一問一答共通)
  const updateCategoryDataLengthMap = useCallback(
    (_list: TestData[], _isQaa: boolean) => {
      const answeredTestIdList = testIdList.answered.total;
      const weakPointTestIdList = testIdList.weakPoint.total;
      const _data = updateCategoryData(_list);
      const categoryDataLengthMap = Object.keys(
        _data,
      ).reduce<CategoryDataLengthMap>((acc, cur) => {
        const subjectData = _data[cur];
        const bigCategoryDataLengthMap = Object.keys(
          subjectData,
        ).reduce<CategoryDataLengthMap>((acc2, cur2) => {
          const bigCategoryData = subjectData[cur2];
          const smallCategoryDataLengthMap = Object.keys(
            bigCategoryData,
          ).reduce<CategoryDataLengthMap>((acc3, cur3) => {
            const smallCategoryData = bigCategoryData[cur3];
            const smallCategoryCell =
              smallCategoryData.reduce<CategoryDataLengthCell>(
                (acc4, cur4) => {
                  try {
                    if (_list[cur4] === undefined) {
                      return acc4;
                    }

                    const testDataId = generateTestDataId(_list[cur4], _isQaa);
                    const isWeakPoint =
                      weakPointTestIdList.includes(testDataId);
                    const isAnswered = answeredTestIdList.includes(testDataId);
                    const isWeakPointOrUnAnswered =
                      /*
                        TestIdList.weakPointOrUnAnsweredTest.total.includes(
                          testDataId,
                        );
                      */
                      isWeakPoint || !isAnswered;
                    const totalList: CategoryDataLengthDifficult = {
                      _total: [...acc4.totalList._total, cur4],
                      _1:
                        _list[cur4].difficult === '1'
                          ? [...acc4.totalList._1, cur4]
                          : acc4.totalList._1,
                      _2:
                        _list[cur4].difficult === '2'
                          ? [...acc4.totalList._2, cur4]
                          : acc4.totalList._2,
                      _3:
                        _list[cur4].difficult === '3'
                          ? [...acc4.totalList._3, cur4]
                          : acc4.totalList._3,
                    };
                    const weakList: CategoryDataLengthDifficult = {
                      _total: isWeakPoint
                        ? [...acc4.weakList._total, cur4]
                        : acc4.weakList._total,
                      _1:
                        isWeakPoint && _list[cur4].difficult === '1'
                          ? [...acc4.weakList._1, cur4]
                          : acc4.weakList._1,
                      _2:
                        isWeakPoint && _list[cur4].difficult === '2'
                          ? [...acc4.weakList._2, cur4]
                          : acc4.weakList._2,
                      _3:
                        isWeakPoint && _list[cur4].difficult === '3'
                          ? [...acc4.weakList._3, cur4]
                          : acc4.weakList._3,
                    };
                    const answeredList: CategoryDataLengthDifficult = {
                      _total: isAnswered
                        ? [...acc4.answeredList._total, cur4]
                        : acc4.answeredList._total,
                      _1:
                        isAnswered && _list[cur4].difficult === '1'
                          ? [...acc4.answeredList._1, cur4]
                          : acc4.answeredList._1,
                      _2:
                        isAnswered && _list[cur4].difficult === '2'
                          ? [...acc4.answeredList._2, cur4]
                          : acc4.answeredList._2,
                      _3:
                        isAnswered && _list[cur4].difficult === '3'
                          ? [...acc4.answeredList._3, cur4]
                          : acc4.answeredList._3,
                    };
                    const unansweredList: CategoryDataLengthDifficult = {
                      _total: isAnswered
                        ? acc4.unansweredList._total
                        : [...acc4.unansweredList._total, cur4],
                      _1:
                        !isAnswered && _list[cur4].difficult === '1'
                          ? [...acc4.unansweredList._1, cur4]
                          : acc4.unansweredList._1,
                      _2:
                        !isAnswered && _list[cur4].difficult === '2'
                          ? [...acc4.unansweredList._2, cur4]
                          : acc4.unansweredList._2,
                      _3:
                        !isAnswered && _list[cur4].difficult === '3'
                          ? [...acc4.unansweredList._3, cur4]
                          : acc4.unansweredList._3,
                    };
                    const weakPointOrUnAnswered: CategoryDataLengthDifficult = {
                      _total: isWeakPointOrUnAnswered
                        ? [...acc4.weakPointOrUnAnswered._total, cur4]
                        : acc4.weakPointOrUnAnswered._total,
                      _1:
                        isWeakPointOrUnAnswered && _list[cur4].difficult === '1'
                          ? [...acc4.weakPointOrUnAnswered._1, cur4]
                          : acc4.weakPointOrUnAnswered._1,
                      _2:
                        isWeakPointOrUnAnswered && _list[cur4].difficult === '2'
                          ? [...acc4.weakPointOrUnAnswered._2, cur4]
                          : acc4.weakPointOrUnAnswered._2,
                      _3:
                        isWeakPointOrUnAnswered && _list[cur4].difficult === '3'
                          ? [...acc4.weakPointOrUnAnswered._3, cur4]
                          : acc4.weakPointOrUnAnswered._3,
                    };
                    return {
                      totalList,
                      weakList,
                      answeredList,
                      unansweredList,
                      weakPointOrUnAnswered,
                    };
                  } catch (error: unknown) {
                    console.error(
                      'updateCategoryDataLengthMap：処理失敗',
                      error,
                    );
                    const {errorName, errorMessage} =
                      error instanceof Error
                        ? {errorName: error.name, errorMessage: error.message}
                        : {
                            errorName: 'UnknownError',
                            errorMessage: 'UnknownError',
                          };
                    logErrorToAnalytics(
                      errorName,
                      errorMessage,
                      'updateCategoryDataLengthMap',
                      {
                        testNo: cur4,
                        subject: cur,
                        bigCategoryTag: cur2,
                        smallCategoryTag: cur3,
                      },
                    );

                    return acc4;
                  }
                },
                {
                  totalList: initialCategoryDataLengthDifficult,
                  weakList: initialCategoryDataLengthDifficult,
                  answeredList: initialCategoryDataLengthDifficult,
                  unansweredList: initialCategoryDataLengthDifficult,
                  weakPointOrUnAnswered: initialCategoryDataLengthDifficult,
                },
              );
            return {
              // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
              ...acc3,
              [`${cur}-${cur2}-${cur3}`]: smallCategoryCell,
            };
          }, {});
          const bigCategoryCell = Object.keys(
            smallCategoryDataLengthMap,
          ).reduce<CategoryDataLengthCell>(
            (acc3, cur3) => {
              if (smallCategoryDataLengthMap[cur3] === undefined) {
                return acc3;
              }

              const totalList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc3.totalList._total,
                  ...smallCategoryDataLengthMap[cur3].totalList._total,
                ],
                _1: [
                  ...acc3.totalList._1,
                  ...smallCategoryDataLengthMap[cur3].totalList._1,
                ],
                _2: [
                  ...acc3.totalList._2,
                  ...smallCategoryDataLengthMap[cur3].totalList._2,
                ],
                _3: [
                  ...acc3.totalList._3,
                  ...smallCategoryDataLengthMap[cur3].totalList._3,
                ],
              };
              const weakList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc3.weakList._total,
                  ...smallCategoryDataLengthMap[cur3].weakList._total,
                ],
                _1: [
                  ...acc3.weakList._1,
                  ...smallCategoryDataLengthMap[cur3].weakList._1,
                ],
                _2: [
                  ...acc3.weakList._2,
                  ...smallCategoryDataLengthMap[cur3].weakList._2,
                ],
                _3: [
                  ...acc3.weakList._3,
                  ...smallCategoryDataLengthMap[cur3].weakList._3,
                ],
              };
              const answeredList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc3.answeredList._total,
                  ...smallCategoryDataLengthMap[cur3].answeredList._total,
                ],
                _1: [
                  ...acc3.answeredList._1,
                  ...smallCategoryDataLengthMap[cur3].answeredList._1,
                ],
                _2: [
                  ...acc3.answeredList._2,
                  ...smallCategoryDataLengthMap[cur3].answeredList._2,
                ],
                _3: [
                  ...acc3.answeredList._3,
                  ...smallCategoryDataLengthMap[cur3].answeredList._3,
                ],
              };
              const unansweredList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc3.unansweredList._total,
                  ...smallCategoryDataLengthMap[cur3].unansweredList._total,
                ],
                _1: [
                  ...acc3.unansweredList._1,
                  ...smallCategoryDataLengthMap[cur3].unansweredList._1,
                ],
                _2: [
                  ...acc3.unansweredList._2,
                  ...smallCategoryDataLengthMap[cur3].unansweredList._2,
                ],
                _3: [
                  ...acc3.unansweredList._3,
                  ...smallCategoryDataLengthMap[cur3].unansweredList._3,
                ],
              };

              const weakPointOrUnAnswered: CategoryDataLengthDifficult = {
                _total: [
                  ...acc3.weakPointOrUnAnswered._total,
                  ...smallCategoryDataLengthMap[cur3].weakPointOrUnAnswered
                    ._total,
                ],
                _1: [
                  ...acc3.weakPointOrUnAnswered._1,
                  ...smallCategoryDataLengthMap[cur3].weakPointOrUnAnswered._1,
                ],
                _2: [
                  ...acc3.weakPointOrUnAnswered._2,
                  ...smallCategoryDataLengthMap[cur3].weakPointOrUnAnswered._2,
                ],
                _3: [
                  ...acc3.weakPointOrUnAnswered._3,
                  ...smallCategoryDataLengthMap[cur3].weakPointOrUnAnswered._3,
                ],
              };
              return {
                totalList,
                weakList,
                answeredList,
                unansweredList,
                weakPointOrUnAnswered,
              };
            },
            {
              totalList: initialCategoryDataLengthDifficult,
              weakList: initialCategoryDataLengthDifficult,
              unansweredList: initialCategoryDataLengthDifficult,
              answeredList: initialCategoryDataLengthDifficult,
              weakPointOrUnAnswered: initialCategoryDataLengthDifficult,
            },
          );
          return {
            // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
            ...acc2,
            [`${cur}-${cur2}`]: bigCategoryCell,
            ...smallCategoryDataLengthMap,
          };
        }, {});
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [cur]: Object.keys(
            bigCategoryDataLengthMap,
          ).reduce<CategoryDataLengthCell>(
            (acc2, cur2) => {
              if (/[^-]*-[^-]*-/.test(cur2)) {
                return acc2;
              }

              const totalList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc2.totalList._total,
                  ...bigCategoryDataLengthMap[cur2].totalList._total,
                ],
                _1: [
                  ...acc2.totalList._1,
                  ...bigCategoryDataLengthMap[cur2].totalList._1,
                ],
                _2: [
                  ...acc2.totalList._2,
                  ...bigCategoryDataLengthMap[cur2].totalList._2,
                ],
                _3: [
                  ...acc2.totalList._3,
                  ...bigCategoryDataLengthMap[cur2].totalList._3,
                ],
              };
              const weakList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc2.weakList._total,
                  ...bigCategoryDataLengthMap[cur2].weakList._total,
                ],
                _1: [
                  ...acc2.weakList._1,
                  ...bigCategoryDataLengthMap[cur2].weakList._1,
                ],
                _2: [
                  ...acc2.weakList._2,
                  ...bigCategoryDataLengthMap[cur2].weakList._2,
                ],
                _3: [
                  ...acc2.weakList._3,
                  ...bigCategoryDataLengthMap[cur2].weakList._3,
                ],
              };
              const answeredList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc2.answeredList._total,
                  ...bigCategoryDataLengthMap[cur2].answeredList._total,
                ],
                _1: [
                  ...acc2.answeredList._1,
                  ...bigCategoryDataLengthMap[cur2].answeredList._1,
                ],
                _2: [
                  ...acc2.answeredList._2,
                  ...bigCategoryDataLengthMap[cur2].answeredList._2,
                ],
                _3: [
                  ...acc2.answeredList._3,
                  ...bigCategoryDataLengthMap[cur2].answeredList._3,
                ],
              };
              const unansweredList: CategoryDataLengthDifficult = {
                _total: [
                  ...acc2.unansweredList._total,
                  ...bigCategoryDataLengthMap[cur2].unansweredList._total,
                ],
                _1: [
                  ...acc2.unansweredList._1,
                  ...bigCategoryDataLengthMap[cur2].unansweredList._1,
                ],
                _2: [
                  ...acc2.unansweredList._2,
                  ...bigCategoryDataLengthMap[cur2].unansweredList._2,
                ],
                _3: [
                  ...acc2.unansweredList._3,
                  ...bigCategoryDataLengthMap[cur2].unansweredList._3,
                ],
              };
              const weakPointOrUnAnswered: CategoryDataLengthDifficult = {
                _total: [
                  ...acc2.weakPointOrUnAnswered._total,
                  ...bigCategoryDataLengthMap[cur2].weakPointOrUnAnswered
                    ._total,
                ],
                _1: [
                  ...acc2.weakPointOrUnAnswered._1,
                  ...bigCategoryDataLengthMap[cur2].weakPointOrUnAnswered._1,
                ],
                _2: [
                  ...acc2.weakPointOrUnAnswered._2,
                  ...bigCategoryDataLengthMap[cur2].weakPointOrUnAnswered._2,
                ],
                _3: [
                  ...acc2.weakPointOrUnAnswered._3,
                  ...bigCategoryDataLengthMap[cur2].weakPointOrUnAnswered._3,
                ],
              };
              return {
                totalList,
                weakList,
                answeredList,
                unansweredList,
                weakPointOrUnAnswered,
              };
            },
            {
              totalList: initialCategoryDataLengthDifficult,
              weakList: initialCategoryDataLengthDifficult,
              unansweredList: initialCategoryDataLengthDifficult,
              answeredList: initialCategoryDataLengthDifficult,
              weakPointOrUnAnswered: initialCategoryDataLengthDifficult,
            },
          ),
          ...bigCategoryDataLengthMap,
        };
      }, {});

      return categoryDataLengthMap;
    },
    [testIdList, updateCategoryData],
  );

  const updateAllDataLengthMap = useCallback(
    (parameters: {list?: TestData[]; qaa?: TestData[]}) => {
      const {list, qaa} = parameters;
      if (list && list.length > 0) {
        const map = updateCategoryDataLengthMap(list, false);
        setCategoryDataLengthMap(map);
        console.log(
          'カテゴリ件数マップ更新（キー数・問題件数）',
          Object.keys(map).length,
          list.length,
        );
      }

      if (qaa && qaa.length > 0) {
        const qaaMap = updateCategoryDataLengthMap(qaa, true);
        setQaaCategoryDataLengthMap(qaaMap);
        console.log(
          'QAAカテゴリ件数マップ更新（キー数）',
          Object.keys(qaaMap).length,
        );
      }
    },
    [updateCategoryDataLengthMap],
  );
  const setTestDataList = useCallback(
    async (list: TestData[]) => {
      _setTestDataList(list);
      const qaa = updateQaaTestDataList(list);
      setQaaTestDataList(qaa);
      updateAllDataLengthMap({list, qaa});
      console.log('問題一覧更新（件数）', list.length);
      console.log('QAA問題一覧更新（件数）', qaa.length);
    },
    [updateQaaTestDataList, updateAllDataLengthMap],
  );

  /** テストデータ調整 */
  const adjustTestData = useCallback(
    async (testData: TestData) => {
      if (!localAssetList) {
        return testData;
      }

      if (!basisDir) {
        return testData;
      }

      const test = await _adjustTestData(
        testData,
        localAssetList,
        basisDir,
      ).catch((error: unknown) => {
        console.error('adjustTestData：処理失敗', error);
        throw new Error('テストデータの調整に失敗しました');
      });
      // Console.log('整形後データ', test);
      return test;
    },
    [basisDir, localAssetList],
  );

  /**  SettingCardにisPreviousプロパティを付与する */
  const addPreviousFlagForSettingCard = useCallback(
    (setting: SettingCardData, bool: boolean) => ({
      ...setting,
      isPreviousSetting: bool,
      updatedAt: now,
    }),
    [],
  );

  /**  SettingCardMapの各データにisPreviousプロパティを付与する */
  const addPreviousFlagForSettingCardMap = useCallback(
    (settings: SettingCardDataMap, bool: boolean) =>
      Object.keys(settings).reduce<SettingCardDataMap>((acc, cur) => {
        const data = settings[cur];
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [cur]: {
            ...data,
            isPreviousSetting: bool,
          },
        };
      }, {}),
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setAnswerlingTestSettingData = useCallback(
    async (data: TestPlayData | null) => {
      if (data === null) {
        // 元々何らかのデータがあり、それを削除する場合CurrentTestsを削除
        if (answerlingTestSettingData) {
          deleteCurrentTests(answerlingTestSettingData.testId).catch(
            (error: unknown) => {
              console.error('setAnswerlingTestSettingData：処理失敗', error);
              throw new Error('テストデータの削除に失敗しました');
            },
          );
          setCurrentRecordKey(null);
        }

        _setAnswerlingTestSettingData(null);
        if (AppEnv === 'test') {
          return;
        }

        setTestPlayData(`${grade}/answerlingTest`, null).catch(
          (error: unknown) => {
            console.error('setAnswerlingTestSettingData：処理失敗', error);
            throw new Error('回答中のテスト設定データの保存に失敗しました');
          },
        );
      } else {
        // データがTaskの場合は処理を行わない
        if (data?.settingCardData.taskSetting) {
          return;
        }

        // データがもともとあり、それが別のテストの場合はそのテストデータを終了させる
        if (
          answerlingTestSettingData &&
          data?.testId !== answerlingTestSettingData.testId
        ) {
          if (AppEnv === 'test') {
            return;
          }

          try {
            console.log('テストデータの更新');
            if (!loginUser?.uid) {
              throw new Error('ユーザーIDが取得できません');
            }

            if (!grade) {
              throw new Error('学年が取得できません');
            }

            const data2: TestPlayDataLog = {
              ...answerlingTestSettingData,
              uid: loginUser.uid,
              changeAt: now,
              grade,
              type:
                answerlingTestSettingData.settingCardData.questionMode ===
                questionMode.practice
                  ? 'practice'
                  : 'exam',
              isQaa: answerlingTestSettingData.settingCardData.isQaa,
              controll: 'update',
              isFinished: true,
              endAt: now,
            };
            console.log(
              'テストデータの更新処理開始',
              summarizeConsoleValue(data2),
            );
            updateTestData(data2, data2.testId).catch((error: unknown) => {
              console.error('setAnswerlingTestSettingData：処理失敗', error);
              throw new Error('テストデータの更新に失敗しました');
            });
          } catch (error: unknown) {
            console.error('setAnswerlingTestSettingData：処理失敗', error);
            throw new Error('既存のテストデータの更新に失敗しました');
          }
        }

        updateCurrentTests(data.testId).catch((error: unknown) => {
          console.error('setAnswerlingTestSettingData：処理失敗', error);
          throw new Error('テストデータの更新に失敗しました');
        });

        const questionCount = data.testDataNoList.length;
        // Const isFinished = questionCount <= data.currentPlayNo;
        const data2 = {
          ...data,
          questionCount,
          settingCardData: {
            ...data.settingCardData,
            // IsFinished,
            isPreviousSetting: false,
          },
        };
        _setAnswerlingTestSettingData(data2);
        if (AppEnv === 'test') {
          return;
        }

        setTestPlayData(`${grade}/answerlingTest`, data2).catch(
          (error: unknown) => {
            console.error('setAnswerlingTestSettingData：処理失敗', error);
            throw new Error('回答中のテスト設定データの保存に失敗しました');
          },
        );
      }
    },
    [
      loginUser,
      answerlingTestSettingData,
      grade,
      _setAnswerlingTestSettingData,
      AppEnv,
      setTestPlayData,
      setCurrentRecordKey,
    ],
  );

  /**
   * [WARNING] この関数をデータの追加・編集目的として直接使うのは可能な限り避けてください
   * 追加・編集目的ではaddSavedSettingList/removeSavedSettingListを使用してください
   * SettingCardMapの各データにisPreviousプロパティを付与する
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setSavedSettingList = useCallback(
    async (settings: SettingCardDataMap) => {
      const data = addPreviousFlagForSettingCardMap(settings, false);
      _setSavedSettingList(data);
      /*
      If (AppEnv === 'test') return;
      await setSettingCardDataMap(`${grade}/savedTest`, data).catch((error: unknown) => {
        console.log(error);
        throw new Error('テスト設定データの保存に失敗しました');
      });
      */
    },
    [savedSettingList],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentSavedSettingNumber = useCallback(
    async (count?: number) => {
      count ??= currentSavedSettingNumber + 1;
      console.log(`新しい問題設定保存用振り分け番号:${count}`);
      _setCurrentSavedSettingNumber(count);
      await setNumberData('currentSavedSettingNumber', count).catch(
        (error: unknown) => {
          console.error('setCurrentSavedSettingNumber：処理失敗', error);
          throw new Error('ストレージへの保存に失敗しました');
        },
      );
    },
    [currentSavedSettingNumber, _setCurrentSavedSettingNumber, setNumberData],
  );

  // テスト設定の保存時のid
  const getSaveSettingId = useCallback(
    (mode: QuestionModeType) => {
      if (mode === questionMode.practice) {
        return `saved-practice-${currentSavedSettingNumber}`;
      }

      return `saved-exam-${currentSavedSettingNumber}`;
    },
    [currentSavedSettingNumber],
  );

  /** 課題保存時のid */
  const getTaskSettingId = useCallback((setting: SettingCardData) => {
    const now = getTodayTimestamp();
    const key = getYmdhmsmString(now);
    if (!setting.taskSetting?.hasTask) {
      return `task-empty-${key}`;
    }

    if (setting.questionMode === questionMode.practice) {
      return `task-practice-${key}`;
    }

    return `task-exam-${key}`;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const addSavedSettingList = useCallback(
    async (setting: SettingCardData) => {
      if (setting.taskSetting?.taskDate === null) {
        throw new Error('taskDate is not defined');
      }

      const id =
        setting.settingState === questionSettingState.saved
          ? getSaveSettingId(setting.questionMode)
          : setting.id === ''
            ? getTaskSettingId(setting)
            : setting.id;

      const newSetting = {
        ...setting,
        id,
      };
      const newCard = addPreviousFlagForSettingCard(newSetting, false);
      const data = {
        ...savedSettingList,
        [id]: newCard,
      };
      const rollbackNumber = currentSavedSettingNumber;
      await setCurrentSavedSettingNumber().catch((error: unknown) => {
        console.error('addSavedSettingList：処理失敗', error);
        throw new Error('設定データの番号の振り直しに失敗しました');
      });
      await setSavedSettingList(data).catch((error: unknown) => {
        console.error('addSavedSettingList：処理失敗', error);
        // 設定データの番号をロールバック
        setCurrentSavedSettingNumber(rollbackNumber)
          .then(() => {
            console.warn('設定保存失敗後に振り分け番号をロールバックしました');
          })
          .catch((error: unknown) => {
            console.error('addSavedSettingList：処理失敗', error);
            throw new Error(
              '設定データを保存できず、設定データの番号のロールバックにも失敗しました',
            );
          });
        throw new Error('設定データの保存に失敗しました');
      });
      if (taskDataRef) {
        setDoc(doc(taskDataRef, id), newCard).catch((error: unknown) => {
          console.error('addSavedSettingList：処理失敗', error);
        });
      }

      setOldLocalTemporarySavedSettingList({
        ...oldLocalTemporarySavedSettingList,
        [id]: newCard,
      });
    },
    [
      savedSettingList,
      currentSavedSettingNumber,
      setCurrentSavedSettingNumber,
      setSavedSettingList,
      addPreviousFlagForSettingCard,
      getSaveSettingId,
      getTaskSettingId,
      oldLocalTemporarySavedSettingList,
      setOldLocalTemporarySavedSettingList,
      taskDataRef,
    ],
  );
  const removeSavedSettingList = useCallback(
    async (id: string) => {
      try {
        const data = {...savedSettingList};
        if (!data[id]) {
          return;
        }

        delete data[id];
        await setSavedSettingList(data);
        if (taskDataRef) {
          deleteDoc(doc(taskDataRef, id)).catch((error: unknown) => {
            console.error('removeSavedSettingList：処理失敗', error);
          });
        }

        if (oldLocalTemporarySavedSettingList?.[id]) {
          const data2 = {...oldLocalTemporarySavedSettingList};
          delete data2[id];
          setOldLocalTemporarySavedSettingList(data2);
        }
      } catch (error) {
        console.error('removeSavedSettingList：処理失敗', error);
        throw new Error('設定データの削除に失敗しました');
      }
    },
    [
      savedSettingList,
      setSavedSettingList,
      oldLocalTemporarySavedSettingList,
      taskDataRef,
    ],
  );
  const removeTargetSavedSettingList = useCallback(async () => {
    try {
      if (targetSavedSettingId === null) {
        return;
      }

      await removeSavedSettingList(targetSavedSettingId);
      setTargetSavedSettingId(null);
    } catch (error) {
      console.error('removeTargetSavedSettingList：処理失敗', error);
      throw new Error('設定データの削除に失敗しました');
    }
  }, [targetSavedSettingId, removeSavedSettingList]);

  const setPreviousSavedSetting = useCallback(
    async (settings: SettingCardData) => {
      const {taskSetting, ...restSettings} = settings;
      // 講師課題は保存しない
      if (taskSetting?.isTeacher) {
        return;
      }

      const data = {
        ...restSettings,
        isPreviousSetting: true,
        id:
          restSettings.questionMode === questionMode.practice
            ? 'previous-practice-0'
            : 'previous-exam-0',
        settingState: questionSettingState.previous,
      };
      _setPreviousSavedSetting(data);
      if (AppEnv === 'test') {
        return;
      }

      await setSettingCardData(`${grade}/previousTest`, data).catch(
        (error: unknown) => {
          console.error('setPreviousSavedSetting：処理失敗', error);
          console.error('前回のテスト設定データの保存に失敗しました');
        },
      );
    },
    [grade, setSettingCardData, AppEnv],
  );

  const generateSettingCardId = useCallback(
    (prefix: SettingCardIdPrefix, mode: SettingCardIdMode, number_: number) =>
      `${prefix}-${mode}-${number_}`,
    [],
  );

  // 起動時データ読み込み
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const loadStartUpData = useCallback(async () => {
    // テストモードの場合、ダミーデータをセットする
    if (AppEnv === 'test') {
      /*
      Await setTestDataList(testDataExample);
      await setAnswerlingTestSettingData(interruptedSavedSettingDummyData);
      await setSavedSettingList(dummySaveAndTaskData); // 課題も共通
      await setPreviousSavedSetting(
        previousSavedSettingDummyData['previous-practice-0'],
      );
      setMessageData(messageDummyData);
      _setCurrentSavedSettingNumber(0);
      */
    } else {
      // Firestore
      // await currentTestsListenSetUp();
      // これらはローカルから読み込む
      /*
      _setSavedSettingList(
        (await getSettingCardDataMap(`${grade}/savedTest`)) ?? {}, // 課題も共通
      );
      */
      const settingCardData = await getSettingCardData(
        `${grade}/previousTest`,
      ).catch((error: unknown) => {
        console.error('loadStartUpData：処理失敗', error);
        console.error('前回のテスト設定データの取得に失敗しました');
        return null;
      });

      _setPreviousSavedSetting(settingCardData);
      // Await deleteData(`${grade}/previousTest`);
      _setCurrentSavedSettingNumber(
        (await getNumberData('currentSavedSettingNumber')) ?? 0,
      );
    }
  }, [
    AppEnv,
    grade,
    getSettingCardData,
    getNumberData,
    _setCurrentSavedSettingNumber,
  ]);

  const getTestDataList = useCallback(
    (isQaa: boolean) => {
      if (isQaa) {
        return qaaTestDataList;
      }

      return testDataList;
    },
    [qaaTestDataList, testDataList],
  );

  /*
  Const getCategoryData = useCallback(
    (isQaa: boolean) => {
      if (isQaa) return qaaCategoryData;
      return categoryData;
    },
    [qaaCategoryData, categoryData],
  );
  */

  const getCategoryDataLengthMap = useCallback(
    (isQaa: boolean) => {
      if (isQaa) {
        return qaaCategoryDataLengthMap;
      }

      return categoryDataLengthMap;
    },
    [qaaCategoryDataLengthMap, categoryDataLengthMap],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const basisDirSetProcess = useCallback(async () => {
    const dir = await getBaseDirectory().catch((error: unknown) => {
      console.error('basisDirSetProcess：処理失敗', error);
      if (typeof error === 'string') {
        setErrorMessage(error);
        return '';
      }

      throw new TypeError('ベースディレクトリの取得に失敗しました');
    });

    setBasisDir(dir);
  }, [setBasisDir]);

  /** Defined Effects */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    basisDirSetProcess().catch((error: unknown) => {
      console.error('GlobalSaveDataContextProvider：処理失敗', error);
      setErrorMessage('ベースディレクトリの取得に失敗しました');
      throw new Error('ベースディレクトリの取得に失敗しました');
    });
  }, []);

  // 問題一覧更新時の生成・集計はsetTestDataListに集約する。
  // このコールバックは回答履歴(testIdList)の変更で更新され、履歴変更時だけ再集計する。
  useUpdateEffect(() => {
    if (testDataList.length === 0) return;
    updateAllDataLengthMap({list: testDataList, qaa: qaaTestDataList});
  }, [updateAllDataLengthMap]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!grade) {
      return;
    }

    if (!loginUser) {
      return;
    }

    loadStartUpData().catch((error: unknown) => {
      console.error('GlobalSaveDataContextProvider：処理失敗', error);
      throw new Error('起動時データの読み込みに失敗しました');
    });
  }, [grade, loginUser]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(
    () => ({
      updateAllDataLengthMap,
      setTestDataList,
      adjustTestData,
      answerlingTestSettingData,
      setAnswerlingTestSettingData,
      updateCategoryData,
      savedSettingList,
      setSavedSettingList,
      oldLocalTempSavedSettingList: oldLocalTemporarySavedSettingList,
      setOldLocalTempSavedSettingList: setOldLocalTemporarySavedSettingList,
      addSavedSettingList,
      removeSavedSettingList,
      setTargetSavedSettingId,
      removeTargetSavedSettingList,
      currentSavedSettingNumber,
      previousSavedSetting,
      setPreviousSavedSetting,
      messageData,
      setMessageData,
      generateSettingCardId,
      getTestDataList,
      //      GetCategoryData,
      categoryDataLengthMap,
      qaaCategoryDataLengthMap,
      getCategoryDataLengthMap,
      localAssetList,
      setLocalAssetList,
      basisDir,
      errorMessage,
    }),
    [
      updateAllDataLengthMap,
      setTestDataList,
      adjustTestData,
      answerlingTestSettingData,
      setAnswerlingTestSettingData,
      updateCategoryData,
      savedSettingList,
      setSavedSettingList,
      oldLocalTemporarySavedSettingList,
      setOldLocalTemporarySavedSettingList,
      addSavedSettingList,
      removeSavedSettingList,
      setTargetSavedSettingId,
      removeTargetSavedSettingList,
      previousSavedSetting,
      setPreviousSavedSetting,
      messageData,
      setMessageData,
      generateSettingCardId,
      getTestDataList,
      categoryDataLengthMap,
      qaaCategoryDataLengthMap,
      //    GetCategoryData,
      getCategoryDataLengthMap,
      localAssetList,
      setLocalAssetList,
      currentSavedSettingNumber,
      basisDir,
      errorMessage,
    ],
  );

  return (
    <GlobalSaveDataContext.Provider value={value}>
      {props.children}
    </GlobalSaveDataContext.Provider>
  );
};

export default GlobalSaveDataContextProvider;

import {summarizeConsoleValue} from '../functionals/consoleLevels';
import {getAuth} from '@react-native-firebase/auth';
import {type LayoutChangeEvent, PixelRatio} from 'react-native';
import {
  createContext,
  useMemo,
  useState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {Timestamp} from '@react-native-firebase/firestore';
import {logErrorToAnalytics} from '@functionals/analyticsController';
import {createChoicesArray} from '../functionals/adjusttestData';
import {
  questionMode,
  type QuestionGradeType,
} from '../../types/commonUnionType';
import firestoreController, {
  updateDailyLog,
  updateTestData,
  createDailyLogId,
  type TestPlayDataLog,
  type DailyLog,
} from '../functionals/firestoreController';
import {
  createEmptyDailyLog,
  createPendingStorageId,
  type PendingDailyLog,
} from '../functionals/pendingDailyLog';
import {getTodayTimestamp} from '../functionals/timeManager';
import {generateTestDataId} from '../functionals/testDataController';
import {
  GlobalSaveDataContext,
  answerMarkStates,
  type AnswerMarkStates,
  type TestPlayData,
  type TestData,
} from './useGlobalSaveDataContext';
import useInterval from './useInterval';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';
import {QuestionSettingViewContext} from './useQuestionSettingViewContext';
import {StorageContext} from './useAsyncStorageContext';
/** Defined Types */
export const webViewState = {
  question: 'question',
  answer: 'answer',
} as const;
export type WebViewState = (typeof webViewState)[keyof typeof webViewState];
/** Defined Context Object */
export type QuestionAndChoicesViewContextObject = {
  isQuitTest: boolean;
  setIsQuitTest: React.Dispatch<React.SetStateAction<boolean>>;
  isAnswerMode: boolean;
  setIsAnswerMode: React.Dispatch<React.SetStateAction<boolean>>;
  testDurationTime: React.RefObject<number>;
  setTestDurationTime: (time: number) => void;
  currentPlayNo: number;
  setCurrentPlayNo: (no: number) => void;
  testDataNoList: number[];
  setTestDataNoList: React.Dispatch<React.SetStateAction<number[]>>;
  answerList: number[];
  setAnswerList: React.Dispatch<React.SetStateAction<number[]>>;
  selectedAnswerList: number[];
  setSelectedAnswerList: React.Dispatch<React.SetStateAction<number[]>>;
  isFinished: boolean;
  setIsFinished: React.Dispatch<React.SetStateAction<boolean>>;
  isAborted: boolean;
  setIsAborted: React.Dispatch<React.SetStateAction<boolean>>;
  correctAnswerCount: number;
  webViewLoadCount: number;
  setWebViewLoadCount: React.Dispatch<React.SetStateAction<number>>;
  answerMark: AnswerMarkStates;
  setAnswerMark: React.Dispatch<React.SetStateAction<AnswerMarkStates>>;
  durationTime: number;
  limitTime: number;
  testFinishedProcess: () => Promise<void>;
  nextQuestionProcess: () => Promise<void>;
  isQaa: boolean;
  setIsQaa: React.Dispatch<React.SetStateAction<boolean>>;
  selectAnswerlingTestChoice: (choice: number, no: number) => void;
  layerZeroPlayNo: number;
  layerOnePlayNo: number;
  displayLayer: 0 | 1;
  currentTestDatalist: TestData[];
  webViewTargetType: WebViewState;
  setWebViewTargetType: React.Dispatch<React.SetStateAction<WebViewState>>;
  startTestProcess: () => Promise<void>;
  layerZeroTestData: TestData | null;
  layerOneTestData: TestData | null;
  handleFooterLayout: (event: LayoutChangeEvent) => void;
  footerHeight: number;
  getSeed: (
    no: number,
    testDataNoList?: number[],
    baseSeed?: number,
    targetTestDataList?: TestData[],
    targetGrade?: QuestionGradeType,
  ) => number;
  initializePlayData: (playData?: TestPlayData) => Promise<void>;
  isAnswerShowed: boolean;
};

type Props = {
  readonly children: ReactNode;
};

export const QuestionAndChoicesViewContext =
  createContext<QuestionAndChoicesViewContextObject>(
    {} as QuestionAndChoicesViewContextObject,
  );
const insertAt = (x: number[], no: number, choice: number): number[] => {
  // もし配列の長さが足りなければ、配列の長さを no+1 に拡張する
  if (x.length <= no) {
    x.length = no + 1;
    // ※注意: 中間のインデックスは稀薄（hole）状態となり、
    // 値は自動的に undefined になります。
  }

  x[no] = choice;
  return x;
};

const transferTestPlayDataLog = (props: {
  testPlayData: TestPlayData;
  uid: string;
  controll: 'update' | 'create' | 'delete';
  displayAnswerList: number[];
  selectedAnswerList: number[];
  currentPlayNo: number;
  testDurationTime: number;
  durationTimePerAnswer: number[];
  isFinished: boolean;
  grade: QuestionGradeType;
}): TestPlayDataLog => {
  const {
    testPlayData,
    uid,
    controll,
    displayAnswerList,
    selectedAnswerList,
    currentPlayNo,
    testDurationTime,
    durationTimePerAnswer,
    isFinished,
    grade,
  } = props;
  return {
    testId: testPlayData.testId,
    uid,
    controll,
    grade,
    type:
      testPlayData.settingCardData.questionMode === questionMode.practice
        ? 'practice'
        : 'exam',
    testDataNoList: testPlayData.testDataNoList,
    answerList: [...testPlayData.answerList],
    questionCount: testPlayData.answerList.length,
    limitTime: testPlayData.limitTime,
    selectedAnswerList,
    currentPlayNo,
    durationTime: testDurationTime,
    durationTimePerAnswer,
    isFinished,
    isQaa: testPlayData.isQaa as boolean,
    correctAnswerCount: displayAnswerList.filter((v, i) => {
      return v === selectedAnswerList[i];
    }).length,
    settingCardData: testPlayData.settingCardData,
    startAt: testPlayData.startAt,
    endAt: isFinished ? Timestamp.now() : null,
    changeAt: Timestamp.now(),
    ...(testPlayData.baseSeed !== undefined && {
      baseSeed: testPlayData.baseSeed,
    }),
  };
};

export const QuestionAndChoicesViewContextProvider = (props: Props) => {
  /** Load Contexts */
  const {
    setAnswerlingTestSettingData,
    getTestDataList,
    adjustTestData,
    setPreviousSavedSetting,
    updateAllDataLengthMap,
  } = useContext(GlobalSaveDataContext);
  const {
    currentDailyLog,
    setCurrentDailyLog,
    currentPlayData,
    setCurrentPlayData,
    grade,
    //    isAnswerShowed,
    //    setIsAnswerShowed,
    isLoading,
    testIdList,
    currentRecordKey,
    setCurrentRecordKey,
    readyForTest,
    setIsDisabledInput,
    getPendingBase,
  } = useContext(GlobalUserSettingContext);
  const {questionModeType} = useContext(QuestionSettingViewContext);
  const {savePendingDailyLog, loadPendingDailyLog, deletePendingDailyLog} =
    useContext(StorageContext);

  /** Defined States */
  /**
   * 以下、現在実施中のテスト用パラメータ
   */
  const [isQuitTest, setIsQuitTest] = useState<boolean>(false);
  // 実施中のテスト番号
  const [currentPlayNo, _setCurrentPlayNo] = useState<number>(0);
  // 実施中のテスト番号リスト
  const [testDataNoList, setTestDataNoList] = useState<number[]>([]);
  // 実施中のテストの正答リスト
  const [answerList, setAnswerList] = useState<number[]>([]);
  // 実施中のテストの回答リスト
  const [selectedAnswerList, setSelectedAnswerList] = useState<number[]>([]);
  // 実施中のテストの終了フラグ
  const [isFinished, setIsFinished] = useState<boolean>(true);
  // 実施中のテストの中断フラグ
  const [isAborted, setIsAborted] = useState<boolean>(false);
  // answerlingTestSettingDataの一次データ
  const [_answerlingTestSettingTempData, _setAnswerlingTestSettingTempData] =
    useState<TestPlayData | null>(null);
  // 実施中のテストの残り時間
  const testDurationTime = useRef<number>(0);
  // このProviderで初期化済みのテストID
  const initializedPlayDataTestId = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setTestDurationTime = useCallback(
    (time: number) => {
      // function (a0) { [bytecode] }1000?
      testDurationTime.current = time;
    },
    [testDurationTime],
  );
  // const testDurationTime = _testDurationTime.current;
  //  const [testDurationTime, setTestDurationTime] = useState<number>(0);
  // WebViewのロード要求カウンタ
  const [webViewLoadCount, setWebViewLoadCount] = useState<number>(0);
  // 解説モードかのフラグ
  const [isAnswerMode, setIsAnswerMode] = useState<boolean>(false);
  // 一問一答モードフラグ
  const [webViewTargetType, setWebViewTargetType] = useState<WebViewState>(
    webViewState.question,
  );
  // 一問一答モードフラグ
  const [isQaa, setIsQaa] = useState<boolean>(false);
  // seed値
  //  const [seed, _setSeed] = useState<number>(0);
  const [layerZeroPlayNo, setLayerZeroPlayNo] = useState<number>(-1);
  const [layerOnePlayNo, setLayerOnePlayNo] = useState<number>(-1);
  const [displayLayer, setDisplayLayer] = useState<0 | 1>(0);
  const [currentTestDatalist, _setCurrentTestDatalist] = useState<TestData[]>(
    [],
  );
  const [layerZeroTestData, setLayerZeroTestData] = useState<TestData | null>(
    null,
  );
  const [layerOneTestData, setLayerOneTestData] = useState<TestData | null>(
    null,
  );
  // ユーザーが選択した回答が正しいかの判定
  const [answerMark, setAnswerMark] = useState<AnswerMarkStates>(
    answerMarkStates.none,
  );
  // webViewBoxのフッターの高さ
  const [footerHeight, setFooterHeight] = useState<number>(0);

  const isAnswerShowed = useMemo(() => {
    return webViewTargetType === webViewState.answer && isAnswerMode;
  }, [webViewTargetType, isAnswerMode]);

  const testDataList = useMemo(
    () => getTestDataList(isQaa),
    [getTestDataList, isQaa],
  );

  const getSeed = useCallback(
    (
      no: number,
      testDataNoList?: number[],
      baseSeed?: number,
      targetTestDataList?: TestData[],
      targetGrade?: QuestionGradeType,
    ) => {
      // console.log('⭐️getSeed', no);
      testDataNoList ??= currentPlayData?.testDataNoList;
      baseSeed ??= currentPlayData?.baseSeed ?? 0;
      targetTestDataList ??= testDataList;
      targetGrade ??= grade;

      if (baseSeed <= 0) {
        return 0;
      }

      if (!testDataNoList) return 0;

      if (testDataNoList.length <= no) return 0;
      if (!targetTestDataList[testDataNoList[no]]) return 0;

      const testData = targetTestDataList[testDataNoList[no]];
      // console.log('⭐️testData', testData);
      // テスト問題の選択肢がシャッフル可能でない場合はseed値を0にする
      if (
        testData.ch1 === '' ||
        testData.ch2 === '' ||
        testData.ch3 === '' ||
        testData.ch4 === '' ||
        (targetGrade === '2級' && testData.ch5 === '') ||
        testData.answerText1 === '' ||
        testData.answerText2 === '' ||
        testData.answerText3 === '' ||
        testData.answerText4 === '' ||
        (targetGrade === '2級' && testData.answerText5 === '')
      ) {
        return 0;
      }

      const _baseSeed = baseSeed || 0;
      // console.log('⭐️baseSeed', _baseSeed);
      return _baseSeed === 0 ? 0 : _baseSeed + no;
    },
    [testDataList, grade, currentPlayData],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentPlayNo = useCallback(
    (no: number) => {
      _setCurrentPlayNo(no);
    },
    [_setCurrentPlayNo],
  );

  // 実施中のテストの正答数
  const correctAnswerCount = useMemo(() => {
    // console.log('answerList', answerList);
    // console.log('selectedAnswerList', selectedAnswerList);
    return answerList.reduce<number>((acc, cur, index) => {
      if (cur === selectedAnswerList[index]) return acc + 1;
      return acc;
    }, 0);
  }, [answerList, selectedAnswerList]);
  const {durationTime, limitTime} = useMemo(
    () =>
      currentPlayData ?? {
        durationTime: 0,
        limitTime: -1,
      },
    [currentPlayData],
  );

  const [weakPointTestIdList, correctlyAnsweredIdList] = useMemo(() => {
    return [testIdList.weakPoint.total, testIdList.correctlyAnswered.total];
  }, [testIdList]);

  /** Defined Functions */
  /** フッターの高さ取得 */
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterHeight(
      PixelRatio.getPixelSizeForLayoutSize(event.nativeEvent.layout.height),
    );
  }, []);
  /** 正解・不正解マークを一定時間後に消し、次の問題へ遷移する */
  const [answerMarkTimer, answerMarkTimerController] = useInterval({
    fn() {
      answerMarkTimerCallback();
    },
    interval: 600,
    autostart: false,
  });
  const switchLayer = useCallback(async () => {
    // 次の問題を裏でレンダリング
    if (displayLayer === 0) {
      setLayerZeroPlayNo(currentPlayNo + 2);
    } else {
      setLayerOnePlayNo(currentPlayNo + 2);
    }

    setDisplayLayer((previous) => (previous === 0 ? 1 : 0));
    setCurrentPlayNo(currentPlayNo + 1);
  }, [displayLayer, currentPlayNo, setCurrentPlayNo]);

  // daiLyLogの更新内容を蓄積保存する
  const pendingDailyLogData = useCallback<
    (params: {
      answerNo: number;
      answerId: string;
      isCorrect: boolean;
    }) => Promise<void>
  >(
    async (params) => {
      if (!currentDailyLog) return;
      if (!currentRecordKey) return;
      if (!grade) return;
      const {answerNo, answerId, isCorrect} = params;
      const uid = firestoreController.app.auth().currentUser?.uid;
      if (!uid) throw new Error('uid is undefined');
      const gradeNumber = grade === '1級' ? 1 : 2;
      const currentRecord = currentDailyLog.playRecord[currentRecordKey];
      if (!currentRecord?.startAt)
        throw new Error('currentDailyLogの開始日時がありません');
      const dailyLogId = createDailyLogId(
        currentRecord.startAt,
        uid,
        gradeNumber,
      );
      const storageId = `${uid}:${dailyLogId}`;
      let pending = await loadPendingDailyLog(storageId);
      pending ??= {
        schemaVersion: 2,
        target: {uid, gradeNumber, dailyLogId},
        base: getPendingBase(dailyLogId),
        delta: {
          ...createEmptyDailyLog(uid, dailyLogId.slice(0, 8)),
          playRecord: {
            [currentRecordKey]: {...currentRecord},
          },
        },
      } satisfies PendingDailyLog;
      const dailyLog = pending.delta;

      if (!dailyLog.playRecord[currentRecordKey]) {
        dailyLog.playRecord = {
          ...dailyLog.playRecord,
          [currentRecordKey]: {...currentRecord},
        };
      }

      dailyLog.answerList.push(answerNo);
      dailyLog.answerIdList.push(answerId);
      if (isCorrect) {
        dailyLog.correctAnswerList.push(answerNo);
        if (weakPointTestIdList.includes(answerId))
          dailyLog.newWeaklyAnswerIdUnRegisted.push(answerId);
        if (dailyLog.newWeaklyAnswerIdRegisted.includes(answerId))
          dailyLog.newWeaklyAnswerIdRegisted =
            dailyLog.newWeaklyAnswerIdRegisted.filter((id) => id !== answerId);
        if (
          !correctlyAnsweredIdList.includes(answerId) &&
          !dailyLog.newCorrectlyAnswerIdRegisted.includes(answerId)
        )
          dailyLog.newCorrectlyAnswerIdRegisted.push(answerId);
      } else {
        if (
          !weakPointTestIdList.includes(answerId) &&
          !dailyLog.newWeaklyAnswerIdRegisted.includes(answerId)
        )
          dailyLog.newWeaklyAnswerIdRegisted.push(answerId);
        if (dailyLog.newWeaklyAnswerIdUnRegisted.includes(answerId))
          dailyLog.newWeaklyAnswerIdUnRegisted =
            dailyLog.newWeaklyAnswerIdUnRegisted.filter(
              (id) => id !== answerId,
            );
      }

      pending.delta = dailyLog;
      await savePendingDailyLog(pending).catch((error: unknown) => {
        console.error('pendingDailyLogDataの保存に失敗', error);
        const message = error instanceof Error ? error.message : '不明なエラー';
        logErrorToAnalytics(message, 'pendingDailyLogDataの保存に失敗');
        throw error;
      });
    },
    [
      weakPointTestIdList,
      correctlyAnsweredIdList,
      savePendingDailyLog,
      loadPendingDailyLog,
      currentRecordKey,
      currentDailyLog,
      grade,
      getPendingBase,
    ],
  );
  /** 次の問題に移る前の処理 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const nextQuestionProcess = useCallback(async () => {
    if (currentPlayData === null) return;
    // テスト全問終了
    if (currentPlayNo + 1 === answerList.length) {
      setIsFinished(true);
    } else {
      setCurrentPlayData({
        ...currentPlayData,
        currentPlayNo: currentPlayData.currentPlayNo + 1,
      });
      setIsAnswerMode((_prev) => false);
      // setIsAnswerShowed(false);
      switchLayer().catch((error: unknown) => {
        console.error('nextQuestionProcess：処理失敗', error);
      });

      /*
      setAnswerlingTestSettingTempData({
        ...currentPlayData,
        currentPlayNo: currentPlayData.currentPlayNo + 1,
      });
      */
      /*
      const testDataIdList = testDataNoList.map((no) => {
        const data = currentTestDatalist[no];
        return generateTestDataId(data);
      });
      */

      // 回答済みの問題リストを更新
      /*
			setAnsweredTestIdList(
				[...answeredTestIdList, ...testDataIdList].filter(
					(value, index, self) => {
						// 重複を削除
						return self.indexOf(value) === index;
					},
				),
			);
			*/
    }
  }, [
    currentPlayData,
    setCurrentPlayData,
    answerList,
    currentPlayNo,
    setIsAnswerMode,
    setIsFinished,
    switchLayer,
    //    setIsAnswerShowed,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const answerMarkTimerCallback = useCallback(() => {
    if (answerMarkTimer === 'Stopped') return;
    if (currentPlayData === null) return;
    if (answerMark === answerMarkStates.none) return; // 2回目以降の呼び出しを防ぐ
    const {settingCardData} = currentPlayData;
    if (currentPlayData.currentPlayNo === null) return;
    if (currentPlayNo === null) return;
    const _isFinished = currentPlayNo + 1 >= testDataNoList.length;
    /*
    const _currentPlayNo =
      currentPlayNo +
      (settingCardData.questionMode === '模擬試験モード' && !_isFinished
        ? 1
        : 0);
    if (currentPlayNo !== _currentPlayNo) setCurrentPlayNo(_currentPlayNo);
    */
    if (settingCardData.questionMode === '練習モード') {
      setIsAnswerMode(true);
      // setIsAnswerShowed(true);
      setWebViewTargetType(webViewState.answer);
      setCurrentPlayData({
        ...currentPlayData,
        currentPlayNo: currentPlayNo + 1,
        durationTime: testDurationTime.current,
        durationTimePerAnswer: [
          ...currentPlayData.durationTimePerAnswer,
          currentPlayData.durationTime - testDurationTime.current,
        ],
        selectedAnswerList,
        isFinished: _isFinished,
      });
    }

    if (settingCardData.questionMode === '模擬試験モード') {
      if (_isFinished) {
        setIsFinished(true);
      } else {
        switchLayer().catch((error: unknown) => {
          console.error('answerMarkTimerCallback：処理失敗', error);
        });
      }
    }

    setAnswerMark(answerMarkStates.none);

    /*
    if (!currentPlayData.settingCardData.taskSetting) {
      const data: TestPlayData = {
        ...currentPlayData,
        durationTime: testDurationTime.current,
        durationTimePerAnswer: [
          ...currentPlayData.durationTimePerAnswer,
          currentPlayData.durationTime - testDurationTime.current,
        ],
        selectedAnswerList,
        _isFinished,
      };
      setAnswerlingTestSettingTempData(data);
    }
      */

    answerMarkTimerController.stopTime();
  }, [
    answerMarkTimer,
    answerMark,
    currentPlayNo,
    testDataNoList,
    selectedAnswerList,
    testDurationTime,
    setIsAnswerMode,
    currentPlayData,
    setCurrentPlayData,
    answerMarkTimerController,
    switchLayer,
    //     setIsAnswerShowed,
  ]);

  /** テスト回答中に選択肢ボタンを押したときの処理 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const selectAnswerlingTestChoice = useCallback(
    (choice: number, no: number) => {
      try {
        if (currentPlayData === null) return;
        if (answerMark !== answerMarkStates.none) return;
        if (isLoading) return;

        //        const no = currentPlayNo;
        const testDataNo = testDataNoList[no];
        const testDataId = generateTestDataId(testDataList[testDataNo], isQaa);
        const isCorrect = answerList[no] === choice;
        const newSelectedAnswerList = insertAt(selectedAnswerList, no, choice);
        // 即座にUI更新
        setAnswerMark(
          isCorrect ? answerMarkStates.correct : answerMarkStates.wrong,
        );
        answerMarkTimerController.startTime();

        // UI更新完了後に重い処理を実行
        // 重い処理を実行

        const executeBackgroundTasks = async () => {
          try {
            // pendingDailyLogData
            await pendingDailyLogData({
              answerNo: testDataNo,
              answerId: testDataId,
              isCorrect,
            });

            // updateTestData
            const uid = getAuth(firestoreController.app).currentUser?.uid;
            if (!uid || !grade) return;
            setSelectedAnswerList([...newSelectedAnswerList]);
            const testPlayDataLog = transferTestPlayDataLog({
              testPlayData: currentPlayData,
              uid,
              controll: 'update',
              displayAnswerList: answerList,
              selectedAnswerList: newSelectedAnswerList,
              currentPlayNo: no + 1,
              testDurationTime: testDurationTime.current,
              durationTimePerAnswer: [
                ...currentPlayData.durationTimePerAnswer,
                currentPlayData.durationTime - testDurationTime.current,
              ],
              isFinished:
                questionModeType === questionMode.exam &&
                no + 1 === answerList.length,
              grade,
            });

            await updateTestData(testPlayDataLog, currentPlayData.testId);
            console.log(
              '⭐️testPlayDataLogを更新',
              summarizeConsoleValue(testPlayDataLog),
            );
          } catch (error: unknown) {
            console.error('バックグラウンドタスクエラー:', error);
          }
        };

        requestAnimationFrame(() => {
          executeBackgroundTasks().catch((error: unknown) => {
            console.error('バックグラウンドタスク実行エラー:', error);
            const message = typeof error === 'string' ? error : '不明なエラー';
            logErrorToAnalytics(
              message,
              'バックグラウンドタスク実行エラー',
              'selectAnswerlingTestChoice',
            );
          });
        });
      } catch (error: unknown) {
        console.error('selectAnswerlingTestChoice：処理失敗', error);
      }
    },
    [
      pendingDailyLogData,
      grade,
      setSelectedAnswerList,
      selectedAnswerList,
      testDurationTime,
      answerList,
      testDataNoList,
      currentPlayData,
      answerMarkTimerController,
      testDataList,
      setAnswerMark,
      isQaa,
      questionModeType,
      answerMark,
      isLoading,
    ],
  );
  /** テスト開始時処理 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const startTestProcess = useCallback(async () => {
    if (currentPlayData === null) return;
    if (currentDailyLog === null) return;
    console.log('テスト開始処理');
    setTestDurationTime(durationTime);
    setIsAnswerMode(false);
    setIsFinished(false);
    setIsAborted(false);
    setIsQuitTest(false);
    setIsDisabledInput(false).catch((error: unknown) => {
      console.error('startTestProcess：処理失敗', error);
    });
    const now = Timestamp.now();
    const key = now.toMillis().toString();

    const newDailyLog: DailyLog = {
      ...currentDailyLog,
      playRecord: {
        ...currentDailyLog.playRecord,
        [key]: {
          startAt: now,
          endAt: null,
        },
      },
    };

    setCurrentDailyLog(newDailyLog);
    setCurrentRecordKey(key);
    // テストモードが練習モードかつquestionCategoryが設定されている場合は、前回の設定に保存
    if (
      currentPlayData.settingCardData.questionMode === '練習モード' &&
      (currentPlayData.settingCardData.practiceQuestionSetting.questionCategory
        .length > 0 ||
        currentPlayData.settingCardData.practiceQuestionSetting
          .qaaQuestionCategory.length > 0)
    ) {
      setPreviousSavedSetting(currentPlayData.settingCardData).catch(
        (error: unknown) => {
          console.error('前回設定保存エラー', error);
        },
      );
    }
  }, [
    currentPlayData,
    durationTime,
    setIsAnswerMode,
    setIsFinished,
    setCurrentDailyLog,
    setCurrentRecordKey,
    setPreviousSavedSetting,
    currentDailyLog,
    setIsDisabledInput,
    setTestDurationTime,
  ]);

  /** テスト終了時処理 */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const testFinishedProcess = useCallback(async () => {
    if (currentPlayData === null) return;
    if (currentRecordKey === null) return;
    if (currentDailyLog === null) return;
    setIsDisabledInput(true, async () => {
      console.log('テスト終了処理');

      if (currentDailyLog.answerList.length > 0 || isFinished) {
        const uid = getAuth(firestoreController.app).currentUser?.uid;
        if (uid === undefined) throw new Error('uid is undefined');
        if (grade === undefined) throw new Error('grade is undefined');
        const gradeNumber = grade === '1級' ? 1 : 2;
        const record = currentDailyLog.playRecord[currentRecordKey];
        const dailyLogId = createDailyLogId(record.startAt, uid, gradeNumber);
        try {
          const pending = await loadPendingDailyLog(`${uid}:${dailyLogId}`);
          if (pending) {
            const finishedAt = Timestamp.now();
            pending.delta.playRecord[currentRecordKey] = {
              ...record,
              endAt: finishedAt,
            };
            // Firestore送信に失敗しても終了時刻を次回へ引き継げるよう先に保存する。
            await savePendingDailyLog(pending);
            // DailyLogを送信
            const dailyLogResult = await updateDailyLog({
              gradeNumber,
              _answerList: pending.delta.answerList,
              _answerIdList: pending.delta.answerIdList,
              _correctAnswerList: pending.delta.correctAnswerList,
              _newCorrectlyAnswerIdRegisted:
                pending.delta.newCorrectlyAnswerIdRegisted,
              _newWeaklyAnswerIdRegisted:
                pending.delta.newWeaklyAnswerIdRegisted,
              _newWeaklyAnswerIdUnRegisted:
                pending.delta.newWeaklyAnswerIdUnRegisted,
              weaklyAnswerIdList: weakPointTestIdList,
              startAt: record.startAt,
              endAt: finishedAt,
              syncContext: {
                source: 'pending',
                dailyLogId: pending.target.dailyLogId,
                base: pending.base,
                playRecord: pending.delta.playRecord,
              },
            });
            if (
              dailyLogResult.status === 'success' ||
              dailyLogResult.status === 'discarded'
            ) {
              await deletePendingDailyLog(createPendingStorageId(pending));
            }
          }
        } catch (error) {
          console.error('DailyLogの更新に失敗', error);
          logErrorToAnalytics(
            error instanceof Error ? error.message : '不明なエラー',
            'DailyLogの更新に失敗',
            'testFinishedProcess',
          );
          // 保留は残し、テスト終了処理自体は継続する。
        }

        const testPlayDataLog = transferTestPlayDataLog({
          testPlayData: currentPlayData,
          uid,
          controll: 'update',
          displayAnswerList: answerList,
          selectedAnswerList,
          currentPlayNo: isAnswerMode ? currentPlayNo + 1 : currentPlayNo,
          testDurationTime: testDurationTime.current,
          durationTimePerAnswer: currentPlayData.durationTimePerAnswer,
          isFinished,
          grade,
        });
        // console.log('testPlayDataLog', testPlayDataLog);
        updateTestData(testPlayDataLog, currentPlayData.testId).catch(
          (error: unknown) => {
            console.error('testFinishedProcess：処理失敗', error);
            // 処理は継続させる
          },
        );
      }

      // console.log('currentPlayData', currentPlayData);
      const savedCorrectAnswerCount = answerList.filter((answer, index) => {
        return answer === selectedAnswerList[index];
      }).length;
      setAnswerlingTestSettingData({
        ...currentPlayData,
        answerList: [...currentPlayData.answerList],
        selectedAnswerList,
        currentPlayNo: isAnswerMode ? currentPlayNo + 1 : currentPlayNo,
        durationTime: testDurationTime.current,
        isFinished,
        testDataNoList,
        correctAnswerCount: savedCorrectAnswerCount,
        endAt: isFinished ? getTodayTimestamp() : null,
      }).catch((error: unknown) => {
        console.error('testFinishedProcess：処理失敗', error);
        throw new Error('回答中データ保存失敗');
      });
      updateAllDataLengthMap(
        isQaa ? {qaa: testDataList} : {list: testDataList},
      );
      setIsDisabledInput(false).catch((error: unknown) => {
        console.error('testFinishedProcess：処理失敗', error);
      });
      readyForTest.initialize();
    }).catch((error: unknown) => {
      console.error('testFinishedProcess：処理失敗', error);
      throw new Error('テスト終了処理に失敗しました');
    });
  }, [
    deletePendingDailyLog,
    readyForTest,
    currentPlayData,
    setAnswerlingTestSettingData,
    answerList,
    selectedAnswerList,
    currentPlayNo,
    testDurationTime,
    isFinished,
    isAnswerMode,
    testDataNoList,
    currentDailyLog,
    grade,
    currentRecordKey,
    weakPointTestIdList,
    setIsDisabledInput,
    updateAllDataLengthMap,
    isQaa,
    loadPendingDailyLog,
    savePendingDailyLog,
    testDataList,
  ]);

  /** PlayData初期化 */
  const initializePlayData = useCallback(
    async (playData?: TestPlayData) => {
      const targetPlayData = playData ?? currentPlayData;
      if (targetPlayData) {
        if (!grade) {
          throw new Error('級が読み込まれていないため、テストを復元できません');
        }

        if (targetPlayData.settingCardData.grade !== grade) {
          throw new Error('保存されたテストと現在の級が一致しません');
        }

        const targetIsQaa = targetPlayData.settingCardData.isQaa ?? false;
        const sourceTestDataList = getTestDataList(targetIsQaa);
        const targetTestDataList = targetPlayData.testDataNoList.map(
          (testDataNo) => {
            const testData = sourceTestDataList[testDataNo];
            if (!testData) {
              throw new Error(
                `問題番号${testDataNo}を参照できないため、テストを復元できません`,
              );
            }

            return testData;
          },
        );
        const rawAnswerList = targetTestDataList.map((testData) =>
          Number(testData.answer),
        );
        const displayAnswerList = rawAnswerList.map((rawAnswer, index) => {
          const seed = getSeed(
            index,
            targetPlayData.testDataNoList,
            targetPlayData.baseSeed ?? 0,
            sourceTestDataList,
            targetPlayData.settingCardData.grade,
          );
          const choicesArray = createChoicesArray(
            targetPlayData.settingCardData.grade,
            seed,
          );
          const displayAnswer = choicesArray.indexOf(rawAnswer) + 1;
          if (displayAnswer === 0) {
            throw new Error(
              `問題番号${targetPlayData.testDataNoList[index]}の正答位置を復元できません`,
            );
          }

          return displayAnswer;
        });

        if (
          !targetPlayData.isFinished &&
          !targetTestDataList[targetPlayData.currentPlayNo]
        ) {
          throw new Error('再開する問題を参照できません');
        }

        const restoredCorrectAnswerCount = displayAnswerList.filter(
          (answer, index) =>
            answer === targetPlayData.selectedAnswerList[index],
        ).length;
        const restoredPlayData: TestPlayData = {
          ...targetPlayData,
          answerList: rawAnswerList,
          correctAnswerCount: restoredCorrectAnswerCount,
          questionCount: targetPlayData.testDataNoList.length,
        };

        setCurrentPlayData(restoredPlayData);
        setIsQaa(targetIsQaa);
        setCurrentPlayNo(restoredPlayData.currentPlayNo);
        setTestDataNoList(restoredPlayData.testDataNoList);
        setAnswerList(displayAnswerList);
        setSelectedAnswerList(restoredPlayData.selectedAnswerList);
        setIsFinished(restoredPlayData.isFinished);
        _setCurrentTestDatalist(targetTestDataList);
        // webViewの初期描画
        setDisplayLayer(0);
        setLayerZeroPlayNo(restoredPlayData.currentPlayNo);
        setLayerOnePlayNo(restoredPlayData.currentPlayNo + 1);
        readyForTest.setIsApp(true);
        initializedPlayDataTestId.current = restoredPlayData.testId;
        console.log('問題データ更新');
        return;
      }

      initializedPlayDataTestId.current = null;
      setCurrentPlayNo(0);
      setTestDataNoList([]);
      setAnswerList([]);
      setSelectedAnswerList([]);
      setIsFinished(false);
      setIsQaa(false);
      setIsQuitTest(false);
      await setIsDisabledInput(false).catch((error: unknown) => {
        console.error('initializePlayData：処理失敗', error);
      });
      readyForTest.initialize();
    },
    [
      currentPlayData,
      getSeed,
      getTestDataList,
      grade,
      readyForTest,
      setCurrentPlayData,
      setCurrentPlayNo,
      setIsDisabledInput,
    ],
  );

  /** Defined Effects */
  // PlayDataが更新されたら各ステートを初期化

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isLoading) return;
    if (!readyForTest.isUser) return;
    if (
      readyForTest.isApp &&
      initializedPlayDataTestId.current === currentPlayData?.testId
    )
      return;

    initializePlayData().catch((error: unknown) => {
      console.error('QuestionAndChoicesViewContextProvider：処理失敗', error);
      readyForTest.initialize();
      setIsDisabledInput(false).catch((unlockError: unknown) => {
        console.error(
          'QuestionAndChoicesViewContextProvider：入力ロック解除失敗',
          unlockError,
        );
      });
    });
  }, [
    isLoading,
    readyForTest.isUser,
    readyForTest.isApp,
    currentPlayData?.testId,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      if (layerZeroPlayNo === -1 || !currentTestDatalist[layerZeroPlayNo]) {
        if (!isCancelled) setLayerZeroTestData(null);
        return;
      }

      try {
        const data = await adjustTestData(currentTestDatalist[layerZeroPlayNo]);
        if (!isCancelled) setLayerZeroTestData(data);
      } catch (error) {
        console.error('fetchData：処理失敗', error);
        if (!isCancelled) setLayerZeroTestData(null);
      }
    };

    fetchData().catch((error: unknown) => {
      console.error('QuestionAndChoicesViewContextProvider：処理失敗', error);
      if (!isCancelled) setLayerZeroTestData(null);
    });

    return () => {
      isCancelled = true;
    };
  }, [layerZeroPlayNo]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    let isCancelled = false;
    const fetchData = async () => {
      if (layerOnePlayNo === -1 || !currentTestDatalist[layerOnePlayNo]) {
        if (!isCancelled) setLayerOneTestData(null);
        return;
      }

      try {
        const data = await adjustTestData(currentTestDatalist[layerOnePlayNo]);
        if (!isCancelled) setLayerOneTestData(data);
      } catch (error) {
        console.error('fetchData：処理失敗', error);
        if (!isCancelled) setLayerOneTestData(null);
      }
    };

    fetchData().catch((error: unknown) => {
      console.error('QuestionAndChoicesViewContextProvider：処理失敗', error);
      if (!isCancelled) setLayerOneTestData(null);
    });

    return () => {
      isCancelled = true;
    };
  }, [layerOnePlayNo]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      isQuitTest,
      setIsQuitTest,
      isAnswerMode,
      setIsAnswerMode,
      testDurationTime,
      setTestDurationTime,
      currentPlayNo,
      setCurrentPlayNo,
      testDataNoList,
      setTestDataNoList,
      answerList,
      setAnswerList,
      selectedAnswerList,
      setSelectedAnswerList,
      isFinished,
      setIsFinished,
      isAborted,
      setIsAborted,
      correctAnswerCount,
      webViewLoadCount,
      setWebViewLoadCount,
      answerMark,
      setAnswerMark,
      durationTime,
      limitTime,
      testFinishedProcess,
      nextQuestionProcess,
      isQaa,
      setIsQaa,
      selectAnswerlingTestChoice,
      layerZeroPlayNo,
      layerOnePlayNo,
      displayLayer,
      currentTestDatalist,
      webViewTargetType,
      setWebViewTargetType,
      startTestProcess,
      layerZeroTestData,
      layerOneTestData,
      handleFooterLayout,
      footerHeight,
      getSeed,
      initializePlayData,
      isAnswerShowed,
    };
  }, [
    isQuitTest,
    setIsQuitTest,
    testDurationTime,
    setTestDurationTime,
    currentPlayNo,
    setCurrentPlayNo,
    testDataNoList,
    setTestDataNoList,
    answerList,
    setAnswerList,
    selectedAnswerList,
    setSelectedAnswerList,
    isFinished,
    setIsFinished,
    isAborted,
    setIsAborted,
    correctAnswerCount,
    webViewLoadCount,
    setWebViewLoadCount,
    isAnswerMode,
    answerMark,
    setAnswerMark,
    durationTime,
    limitTime,
    testFinishedProcess,
    nextQuestionProcess,
    isQaa,
    setIsQaa,
    selectAnswerlingTestChoice,
    layerZeroPlayNo,
    layerOnePlayNo,
    displayLayer,
    currentTestDatalist,
    webViewTargetType,
    setWebViewTargetType,
    startTestProcess,
    layerZeroTestData,
    layerOneTestData,
    handleFooterLayout,
    footerHeight,
    getSeed,
    initializePlayData,
    isAnswerShowed,
  ]);

  return (
    <QuestionAndChoicesViewContext.Provider value={value}>
      {props.children}
    </QuestionAndChoicesViewContext.Provider>
  );
};

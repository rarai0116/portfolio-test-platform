import {getAuth} from '@react-native-firebase/auth';
import React, {
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type {FlatList} from 'react-native-gesture-handler';
import {Timestamp} from '@react-native-firebase/firestore';
import {
  type QuestionModeType,
  type QuestionSettingStateType,
  questionSettingState,
  questionMode,
  questionState,
} from '../../../types/commonUnionType';
import {getTodayTimestamp} from '../../functionals/timeManager';
import {getRandomElements} from '../../functionals/adjusttestData';
import firestoreController, {
  type TestPlayDataLog,
  updateTestData,
  createTestId,
} from '../../functionals/firestoreController';
import {GlobalUserSettingContext} from '../useGlobalUserSettingContext';
import {
  InitialSettingDataContext,
  practiceQuestionOptions,
  practiceQuestionOrder,
} from '../useInitialSettingDataContext';
import {
  GlobalSaveDataContext,
  type SettingCardData,
  type TestData,
  type TestPlayData,
} from '../useGlobalSaveDataContext';
import {TaskDataContext} from '../useTaskDataContext';
import useSaveSetting, {type SaveSetting} from './hooks/useSaveSetting';
import useExamQuestionSetting from './hooks/useExamQuestionSetting';
import usePracticeQuestionSetting from './hooks/usePracticeQuestionSetting';
import type * as ExamQuestionSettingTypes from './hooks/useExamQuestionSetting';
import type * as PracticeQuestionSettingTypes from './hooks/usePracticeQuestionSetting';

/** Defined Types */
export type ExamQuestionSettingIdList =
  ExamQuestionSettingTypes.ExamQuestionSettingIdList;
export type ExamQuestionSettingType =
  ExamQuestionSettingTypes.ExamQuestionSettingType;
export type PracticeQuestionSettingIdList =
  PracticeQuestionSettingTypes.PracticeQuestionSettingIdList;
export type PracticeQuestionSettingType =
  PracticeQuestionSettingTypes.PracticeQuestionSettingType;
export type PracticeQuestionSettingOtherTypedIdList =
  PracticeQuestionSettingTypes.PracticeQuestionSettingOtherTypedIdList;

type QuestionSettingViewContextObject = {
  currentSettingId: string;
  setCurrentSettingId: (
    id: string,
    taskOption?: {
      questionModeType: QuestionModeType;
    },
  ) => void;
  settingState: QuestionSettingStateType;
  questionModeType: QuestionModeType;

  // 問題設定モーダルのページ管理
  practiceSlides: string[];
  examSlides: string[];
  currentIndex: number | null;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number | null>>;
  slidesRef: React.RefObject<FlatList | null>;
  scrollFoward: (slides: string[]) => void;
  scrollBackward: () => void;
  onPressStartPracticeTest: (id?: string) => Promise<void>;
  onPressStartExamTest: (id?: string) => Promise<void>;
  startPracticeTest: (id: string, cardData: SettingCardData) => Promise<void>;
  startExamTest: (id: string, cardData: SettingCardData) => Promise<void>;
} & SaveSetting &
  PracticeQuestionSettingTypes.PracticeQuestionSetting &
  ExamQuestionSettingTypes.ExamQuestionSetting;

type Props = {
  readonly children: ReactNode;
  readonly id?: string;
};

export const QuestionSettingViewContext =
  createContext<QuestionSettingViewContextObject>(
    {} as QuestionSettingViewContextObject,
  );

export const idToSettingState = (id: string) => {
  const pattern = /(subject|big|small)/g;
  switch (true) {
    case id.includes('initialSetting'): {
      return questionSettingState.initial;
    }

    case id.includes('task'): {
      return questionSettingState.task;
    }

    case id.includes('saved'): {
      return questionSettingState.saved;
    }

    case id.includes('previous'): {
      return questionSettingState.previous;
    }

    case id.includes('interrupted'): {
      return questionSettingState.interrupted;
    }

    case pattern.test(id): {
      return questionSettingState.categoryDataAnalysis;
    }

    default: {
      return questionSettingState.initial;
    }
  }
};

const QuestionSettingViewContextProvider = (props: Props) => {
  /** Load Context */
  const {grade, setCurrentPlayData, readyForTest, setIsDisabledInput} =
    useContext(GlobalUserSettingContext);

  const {
    initialPracticeQuestionSetting,
    initialExamQuestionSettingId,
    initialPracticeQuestionSettingId,
  } = useContext(InitialSettingDataContext);

  const {
    generateSettingCardId,
    setAnswerlingTestSettingData,
    addSavedSettingList,
  } = useContext(GlobalSaveDataContext);

  /** Defined States */
  const [currentSetting, setCurrentSetting] = useState({
    currentSettingId: props.id ?? 'initialSetting-practice-0',
    settingState: questionSettingState.initial as QuestionSettingStateType,
    questionModeType: questionMode.practice as QuestionModeType,
    isCalledSaved: false,
  });
  const {currentSettingId, settingState, questionModeType} = currentSetting;
  const {taskSettingList} = useContext(TaskDataContext);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setCurrentSettingId = useCallback(
    (id: string, taskOption?: {questionModeType: QuestionModeType}) => {
      const settingState: QuestionSettingStateType = idToSettingState(id);
      const questionModeType: QuestionModeType = (() => {
        if (taskOption) {
          return taskOption.questionModeType;
        }

        switch (true) {
          case id.includes('practice'): {
            return questionMode.practice;
          }

          case id.includes('exam'): {
            return questionMode.exam;
          }

          default: {
            return questionMode.practice;
          }
        }
      })();
      const isCalledSaved: boolean = (() => {
        return (
          settingState === questionSettingState.saved ||
          settingState === questionSettingState.task
        );
      })();
      const currentSettingId = id;

      setCurrentSetting({
        currentSettingId,
        settingState,
        questionModeType,
        isCalledSaved,
      });
    },
    [setCurrentSetting],
  );

  /** 現在のスライドindex */
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const slidesRef = useRef<FlatList | null>(null);

  /** Defined Memos */
  const now = useMemo(() => getTodayTimestamp(), []);
  /** モーダルのスライド */
  const practiceSlides: string[] = useMemo(() => {
    return [
      'practice-step1',
      'practice-step2',
      'practice-step3',
      'practice-step4',
      'practice-step5',
    ];
  }, []);
  const examSlides: string[] = useMemo(() => {
    return ['exam-step1', 'exam-step2', 'exam-step3'];
  }, []);

  /** Custom Hooks */
  const practiceQuestionSetting = usePracticeQuestionSetting({
    id: props.id!,
    currentSetting,
  });

  const {
    questionTimeInfo,
    questionNumberOfQuestionsInfo,
    currentSelectedPracticeSettingIdList,
    isCurrentSelectedQaa,
    testDataList,
    getSettedTargetingTestData,
    setQualifiedQuestionCount,
    setRequiredQuestionCount,
    isPracticeQuestionStartReserved,
    setIsPracticeQuestionStartReserved,
  } = practiceQuestionSetting;

  const examQuestionSetting = useExamQuestionSetting({
    id: props.id!,
    currentSetting,
  });

  const {
    examSubjectCheckedButtonInfoList,
    examNumberOfQuestionsCheckedButtonList,
    currentSelectedExamSettingIdList,
  } = examQuestionSetting;

  const saveSetting = useSaveSetting({
    questionModeType,
    isSavable: settingState === questionSettingState.initial,
    currentSelectedPracticeSettingIdList,
    currentSelectedExamSettingIdList,
    currentIndex,
    practiceSlides,
    examSlides,
  });

  /** Defined Functions */
  /** スライドを前にスクロール */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const scrollFoward = useCallback(
    (slides: string[]) => {
      if (
        slidesRef?.current &&
        currentIndex !== null &&
        currentIndex < slides.length - 1
      ) {
        slidesRef.current.scrollToIndex({
          animated: true,
          index: currentIndex + 1,
        });
      } else {
      }
    },
    [slidesRef, currentIndex],
  );

  /** スライドを後ろににスクロール */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const scrollBackward = useCallback(() => {
    if (slidesRef?.current && currentIndex !== null && currentIndex > 0) {
      slidesRef.current.scrollToIndex({index: currentIndex - 1});
    } else {
    }
  }, [slidesRef, currentIndex]);

  // 対象のリストからランダムに問題を選出
  const createTestDataNolist = useCallback(
    (
      targetList: TestData[],
      _currentSelectedPracticeSettingIdList?: PracticeQuestionSettingIdList,
    ) => {
      _currentSelectedPracticeSettingIdList ??=
        currentSelectedPracticeSettingIdList;

      const inOrder =
        _currentSelectedPracticeSettingIdList.questionOrder.includes(
          practiceQuestionOrder.inOrder.id,
        );

      const numberOfQuestions =
        _currentSelectedPracticeSettingIdList.numberOfQuestions[0];
      const selectedValue = Number(
        numberOfQuestions.replace('pqs_questionNumberOfQuestions_input_', ''),
      );
      void [
        numberOfQuestions.replace('pqs_questionNumberOfQuestions_input_', ''),
      ];
      if (Number.isNaN(selectedValue))
        throw new Error('選択された問題数が不正です');

      const count = selectedValue;

      const list = targetList.map((v) => v.no);

      const testDataNoList = getRandomElements(list, count);
      const orderedTestDataNoList = inOrder
        ? testDataNoList.sort((a, b) => {
            return (
              Number(testDataList[a].testNo) - Number(testDataList[b].testNo)
            );
          })
        : testDataNoList;
      return orderedTestDataNoList;
    },
    [currentSelectedPracticeSettingIdList, testDataList],
  );

  // テストデータをfirestoreに作成
  const createTestDataDb = useCallback(
    async (testPlayDataLog: TestPlayDataLog) => {
      let testId = '';
      const result = await updateTestData(testPlayDataLog).catch(
        (error: unknown) => {
          console.error('UPDATE TESTDATA ERROR', error);
          if (typeof error === 'string') throw new Error(error);
          throw new Error('不明なエラーがupdateTestDataで発生しました');
        },
      );

      if (result.status === 'error') {
        if (result.errorMessage?.includes('[please retry]')) {
          // nowの1ミリ秒後のTimeStampを取得
          const timestamp = Timestamp.fromMillis(now.toMillis() + 1);
          const result2 = await updateTestData(
            testPlayDataLog,
            createTestId(timestamp),
          ).catch((error: unknown) => {
            console.error('createTestDataDb：処理失敗', error);
            if (typeof error === 'string') throw new Error(error);
            throw new Error('不明なエラーがupdateTestDataで発生しました');
          });
          testId = result2.testId;
        } else {
          throw new Error(result.errorMessage);
        }
      } else {
        testId = result.testId;
      }

      return testId;
    },
    [now],
  );
  // テストデータ作成
  const createTestPlayData = useCallback(
    (
      testDataNoList: number[],
      time?: number,
      id?: string,
      _settingState?: QuestionSettingStateType,
      params?: {
        _currentSelectedPracticeSettingIdList: PracticeQuestionSettingIdList;
        _currentSelectedExamSettingIdList: ExamQuestionSettingIdList;
        _isQaa: boolean;
        _questionModeType: QuestionModeType;
      },
    ) => {
      id ??= currentSettingId;
      _settingState ??= settingState;
      const {
        _currentSelectedPracticeSettingIdList,
        _currentSelectedExamSettingIdList,
        _isQaa,
        _questionModeType,
      } = params ?? {
        _currentSelectedPracticeSettingIdList:
          currentSelectedPracticeSettingIdList,
        _currentSelectedExamSettingIdList: currentSelectedExamSettingIdList,
        _isQaa: isCurrentSelectedQaa,
        _questionModeType: questionModeType,
      };

      const answerList = testDataNoList.map(
        (v) => Number(testDataList[v].answer), // 一問一答
      );
      //      console.log('taskSettingList', taskSettingList);
      if (!id && _settingState === questionSettingState.task)
        throw new Error('id is null');

      const taskSetting = taskSettingList[id]?.taskSetting;

      const settingCardData: SettingCardData = {
        id:
          _settingState === questionSettingState.task
            ? id
            : generateSettingCardId(
                'interrupted',
                _questionModeType === questionMode.exam ? 'exam' : 'practice',
                0,
              ),
        title:
          _settingState === questionSettingState.task
            ? taskSettingList[id].title
            : 'underfined',
        grade: grade!,
        settingState:
          _settingState === questionSettingState.task
            ? questionSettingState.task
            : questionSettingState.interrupted,
        questionMode: _questionModeType,
        practiceQuestionSetting:
          _questionModeType === questionMode.practice
            ? _currentSelectedPracticeSettingIdList
            : {
                qaaQuestionCategory: [],
                questionCategory: [],
                questionFormat: [],
                questionOrder: [],
                questionCoverage: [],
                questionDifficulties: [],
                option: [],
                questionTime: [],
                numberOfQuestions: [],
              },
        examQuestionSetting:
          _questionModeType === questionMode.exam
            ? {
                subject: _currentSelectedExamSettingIdList.subject, // examSubjectCheckedButtonInfoList.map((v) => v.id),
                numberOfQuestions:
                  _currentSelectedExamSettingIdList.numberOfQuestions,
              }
            : {
                subject: [],
                numberOfQuestions: [],
              },
        isQaa: _questionModeType === questionMode.practice && _isQaa,
        isCurrentSelectedQaa:
          _currentSelectedPracticeSettingIdList.questionFormat[0] ===
          initialPracticeQuestionSetting.questionFormat[1].id,

        ...(_settingState === questionSettingState.task &&
          taskSetting && {
            taskSetting: {
              ...taskSetting,
              taskState: questionState.progress,
            },
          }),
      };

      const selectedAnswerList = Array.from({
        length: answerList.length,
      }).fill(0) as number[];

      const startAt = now;
      const baseSeed = (() => {
        if (_questionModeType === questionMode.exam) return 0;
        if (
          !_currentSelectedPracticeSettingIdList.option.includes(
            practiceQuestionOptions.shuffleChoices.id,
          )
        )
          return 0;
        return Math.floor(Math.random() * 100_000) + 1;
      })();

      const testPlayData: TestPlayData = {
        testId: '',
        testDataNoList,
        answerList,
        selectedAnswerList,
        currentPlayNo: 0,
        isFinished: false,
        correctAnswerCount: 0,
        questionCount: testDataNoList.length,
        durationTime: 0,
        durationTimePerAnswer: [],
        limitTime: time ?? 0,
        baseSeed,
        startAt,
        endAt: null,
        settingCardData,
      };

      return testPlayData;
    },
    [
      now,
      currentSelectedPracticeSettingIdList,
      currentSelectedExamSettingIdList,
      grade,
      questionModeType,
      generateSettingCardId,
      initialPracticeQuestionSetting,
      testDataList,
      isCurrentSelectedQaa,
      settingState,
      currentSettingId,
      taskSettingList,
    ],
  );
  /** 練習モード開始 */
  const onPressStartPracticeTest = useCallback(
    async (id?: string) => {
      return new Promise<void>((resolve, reject) => {
        setIsDisabledInput(true, async () => {
          id ??= currentSettingId;
          const _settingState = idToSettingState(id);

          const targetList = getSettedTargetingTestData();

          void [Number(questionNumberOfQuestionsInfo.selectedValue)];
          setQualifiedQuestionCount(targetList.length);
          setRequiredQuestionCount(
            Number(questionNumberOfQuestionsInfo.selectedValue),
          );
          // 対象の問題が規定の問題数に達しているかのチェック
          if (targetList.length === 0) {
            throw new Error('E1:対象の問題がありません');
          }

          if (
            targetList.length <
            Number(questionNumberOfQuestionsInfo.selectedValue)
          ) {
            throw new Error('E2:対象の問題が規定の問題数に達していません');
          }

          const testDataNoList = createTestDataNolist(targetList);

          const practiceDurationTime =
            questionTimeInfo.label === '無制限'
              ? 0
              : Number(questionTimeInfo.selectedValue) * 60 * 1000;
          const testPlayData = createTestPlayData(
            testDataNoList,
            practiceDurationTime,
            id,
            idToSettingState(id),
          );

          // firestoreにテストデータを送信
          const testPlayDataLog: TestPlayDataLog = {
            ...testPlayData,
            uid: getAuth(firestoreController.app).currentUser!.uid,
            controll: 'create',
            grade: testPlayData.settingCardData.grade,
            changeAt: Timestamp.now(),
            type: 'practice',
            isQaa: testPlayData.settingCardData.isQaa ?? false,
          };
          const testId = await createTestDataDb(testPlayDataLog).catch(
            (error: unknown) => {
              console.error('onPressStartPracticeTest：処理失敗', error);
              if (typeof error === 'string') throw new Error(error);
              throw new Error('不明なエラーがcreateTestDataDbで発生しました');
            },
          );

          const currentData: TestPlayData = {
            ...testPlayData,
            testId,
            settingCardData: {
              ...testPlayData.settingCardData,
              ...(_settingState === questionSettingState.task &&
                testPlayData.settingCardData.taskSetting && {
                  taskSetting: {
                    ...testPlayData.settingCardData.taskSetting,
                    testId,
                  },
                }),
            },
          };

          addSavedSettingList(currentData.settingCardData).catch(
            (error: unknown) => {
              console.error('onPressStartPracticeTest：処理失敗', error);
              throw new Error('データを保存リストに追加できませんでした');
            },
          );
          await setAnswerlingTestSettingData(currentData).catch(
            (error: unknown) => {
              console.error('onPressStartPracticeTest：処理失敗', error);
            },
          );
          setCurrentPlayData(currentData);
          readyForTest.setIsUser(true);
          resolve();
        }).catch((error: unknown) => {
          setIsDisabledInput(false).catch((error: unknown) => {
            console.error('onPressStartPracticeTest：処理失敗', error);
          });
          if (error instanceof Error) {
            console.error('onPressStartPracticeTest：処理失敗', error);
            reject(
              new Error(
                `練習モード開始時にエラーが発生しました: ${error.message}`,
              ),
            );
            return;
          }

          reject(new Error('練習モード開始時に不明なエラーが発生しました'));
        });
      });
    },
    [
      questionNumberOfQuestionsInfo,
      createTestDataDb,
      createTestPlayData,
      createTestDataNolist,
      setAnswerlingTestSettingData,
      setCurrentPlayData,
      questionTimeInfo,
      readyForTest,
      setIsDisabledInput,
      getSettedTargetingTestData,
      addSavedSettingList,
      setQualifiedQuestionCount,
      setRequiredQuestionCount,
      currentSettingId,
    ],
  );
  const createExamTestDataNolistAndTime = useCallback(
    (targetList: TestData[], numberOfQuestions?: string) => {
      if (!numberOfQuestions) {
        if (typeof examNumberOfQuestionsCheckedButtonList[0].value !== 'string')
          throw new Error('問題数の設定が不正です');
        if (examNumberOfQuestionsCheckedButtonList[0].value === undefined)
          throw new Error('問題数の設定が未選択です');

        numberOfQuestions = examNumberOfQuestionsCheckedButtonList[0].value;
      }

      // 25問_40分
      /*
      const nullReturn = {testDataNoList: [], time: '0'};
      if (examNumberOfQuestionsCheckedButtonList.length === 0)
        return nullReturn;
      if (examNumberOfQuestionsCheckedButtonList[0].value === undefined)
        return nullReturn;
      if (typeof examNumberOfQuestionsCheckedButtonList[0].value !== 'string')
        return nullReturn;
      console.log(examNumberOfQuestionsCheckedButtonList[0].value);
      */
      const [_match, _count, timeString] = /(\d+)問_(\d+)分/.exec(
        numberOfQuestions,
      )!;

      const count = Number(_count);
      if (Number.isNaN(count) || count <= 0)
        throw new Error('問題数の設定が不正です');

      const list = targetList.map((v) => v.no);
      const randomList = getRandomElements(list, Number(count));
      const subjectNums: Record<string, number> = {
        学科Ⅰ: 1,
        学科Ⅱ: 2,
        学科Ⅲ: 3,
        学科Ⅳ: 4,
        学科Ⅴ: 5,
      };
      const testDataNoList = randomList
        .sort((a, b) => {
          // 試験番号順にソート

          return (
            Number(testDataList[a].testNo) - Number(testDataList[b].testNo)
          );
        })
        .sort((a, b) => {
          // 学科順にソート
          const subjectNumA = subjectNums[testDataList[a].subject];
          const subjectNumB = subjectNums[testDataList[b].subject];
          return subjectNumA - subjectNumB;
        });

      const time = Number(timeString);
      return {testDataNoList, time};
    },
    [examNumberOfQuestionsCheckedButtonList, testDataList],
  );

  /** 模擬試験モード開始 */
  const onPressStartExamTest = useCallback(
    async (id?: string) => {
      id ??= currentSettingId;
      if (examSubjectCheckedButtonInfoList[0] === undefined) return;
      setIsDisabledInput(true, async () => {
        const subjectKey =
          /_(subject[^_]+).*$/.exec(
            examSubjectCheckedButtonInfoList[0].id,
          )![1] ?? '';
        const numbers: Record<string, string> = {
          One: '学科Ⅰ',
          Two: '学科Ⅱ',
          Three: '学科Ⅲ',
          Four: '学科Ⅳ',
          Five: '学科Ⅴ',
        };

        const subjects: string[] = (() => {
          const keys = Object.keys(numbers);
          return keys
            .filter((key) => {
              return subjectKey.includes(key);
            })
            .map((v, _i) => {
              return numbers[v];
            });
        })();
        // console.log('subjects', subjects);

        // console.log('testDataList', testDataList);
        const targetList = subjects.flatMap((subject) => {
          return testDataList.filter((v) => v.subject === subject); // 一問一答
        });
        // console.log('targetList', targetList);
        const {testDataNoList, time} =
          createExamTestDataNolistAndTime(targetList);
        const timeLimit = Number(time) * 60 * 1000;
        // console.log('testDataNoList', testDataNoList);
        const testPlayData = createTestPlayData(
          testDataNoList,
          timeLimit,
          id,
          idToSettingState(id),
        );

        // firestoreにテストデータを送信
        const testPlayDataLog: TestPlayDataLog = {
          uid: getAuth(firestoreController.app).currentUser!.uid,
          controll: 'create',
          changeAt: Timestamp.now(),
          grade: testPlayData.settingCardData.grade,
          type: 'exam',
          isQaa: testPlayData.settingCardData.isQaa ?? false,
          ...testPlayData,
        };

        const testId = await createTestDataDb(testPlayDataLog).catch(
          (error: unknown) => {
            console.error('onPressStartExamTest：処理失敗', error);
            if (typeof error === 'string') throw new Error(error);
            throw new Error('不明なエラーがcreateTestDataDbで発生しました');
          },
        );
        const currentData: TestPlayData = {
          ...testPlayData,
          testId,
          settingCardData: {
            ...testPlayData.settingCardData,
            ...(settingState === questionSettingState.task &&
              testPlayData.settingCardData.taskSetting && {
                taskSetting: {
                  ...testPlayData.settingCardData.taskSetting,
                  testId,
                },
              }),
          },
        };

        addSavedSettingList(currentData.settingCardData).catch(
          (error: unknown) => {
            console.error('onPressStartExamTest：処理失敗', error);
            throw new Error('データを保存リストに追加できませんでした');
          },
        );
        setCurrentPlayData(() => currentData);
        setAnswerlingTestSettingData(currentData).catch((error: unknown) => {
          console.error('onPressStartExamTest：処理失敗', error);
          if (typeof error === 'string')
            throw new Error(`テストデータ保存エラー:${error}`);
          throw new Error('テストデータ保存エラー');
        });
        readyForTest.setIsUser(true);
      }).catch((_error: unknown) => {
        setIsDisabledInput(false).catch((error: unknown) => {
          if (typeof error === 'string') {
            console.error('onPressStartExamTest：処理失敗', error);
            throw new Error(
              `模擬試験モード開始時にエラーが発生しました: ${error}`,
            );
          }

          throw new Error('模擬試験モード開始時に不明なエラーが発生しました');
        });
      });
    },
    [
      createTestDataDb,
      createExamTestDataNolistAndTime,
      createTestPlayData,
      setAnswerlingTestSettingData,
      examSubjectCheckedButtonInfoList,
      testDataList,
      setCurrentPlayData,
      readyForTest,
      setIsDisabledInput,
      addSavedSettingList,
      settingState,
      currentSettingId,
    ],
  );

  /**  settingStateに依存しない練習モード開始処理 */
  const startPracticeTest = useCallback(
    async (id: string, cardData: SettingCardData) => {
      setIsDisabledInput(true, async () => {
        const {isQaa, practiceQuestionSetting} = cardData;
        const {
          questionCategory: _questionCategory,
          qaaQuestionCategory: _qaaQuestionCategory,
        } = practiceQuestionSetting;
        const numberOfQuestions =
          practiceQuestionSetting.numberOfQuestions[0] ??
          initialPracticeQuestionSetting.numberOfQuestions[0].id;

        const targetList = getSettedTargetingTestData(
          isQaa,
          practiceQuestionSetting,
        );

        void [Number(numberOfQuestions)];
        setQualifiedQuestionCount(targetList.length);
        setRequiredQuestionCount(Number(numberOfQuestions));
        // 対象の問題が規定の問題数に達しているかのチェック
        if (targetList.length === 0) {
          throw new Error('E1:対象の問題がありません');
        }

        if (targetList.length < Number(numberOfQuestions)) {
          throw new Error('E2:対象の問題が規定の問題数に達していません');
        }

        const testDataNoList = createTestDataNolist(
          targetList,
          practiceQuestionSetting,
        );

        void [
          {
            testDataNoList,
            currentTestNo: 0,
            limitTime: 0,
            currentTime: 0,
            isChoicesShuffle: practiceQuestionSetting.option.includes(
              practiceQuestionOptions.shuffleChoices.id,
            ),
          },
        ];

        const _questionTimeInfo = practiceQuestionSetting.questionTime[0];
        const practiceDurationTime =
          _questionTimeInfo ===
          initialPracticeQuestionSetting.questionTime[0].id
            ? 0
            : Number(_questionTimeInfo.replace('pqs_questionTime_input_', '')) *
              60 *
              1000;
        if (Number.isNaN(practiceDurationTime)) {
          console.error('練習時間が不正です', practiceDurationTime);
          throw new Error('練習時間が不正です');
        }

        const _settingState = idToSettingState(id);
        const testPlayData = createTestPlayData(
          testDataNoList,
          practiceDurationTime,
          id,
          _settingState,
          {
            _isQaa: isQaa,
            _currentSelectedPracticeSettingIdList: practiceQuestionSetting,
            _currentSelectedExamSettingIdList: initialExamQuestionSettingId,
            _questionModeType: questionMode.practice,
          },
        );

        // firestoreにテストデータを送信
        const testPlayDataLog: TestPlayDataLog = {
          ...testPlayData,
          uid: getAuth(firestoreController.app).currentUser!.uid,
          controll: 'create',
          grade: testPlayData.settingCardData.grade,
          changeAt: Timestamp.now(),
          type: 'practice',
          isQaa: testPlayData.settingCardData.isQaa ?? false,
        };
        const testId = await createTestDataDb(testPlayDataLog).catch(
          (error: unknown) => {
            console.error('startPracticeTest：処理失敗', error);
            if (typeof error === 'string') throw new Error(error);
            throw new Error('不明なエラーがcreateTestDataDbで発生しました');
          },
        );

        const currentData: TestPlayData = {
          ...testPlayData,
          testId,
          settingCardData: {
            ...testPlayData.settingCardData,
            ...(_settingState === questionSettingState.task &&
              testPlayData.settingCardData.taskSetting && {
                taskSetting: {
                  ...testPlayData.settingCardData.taskSetting,
                  testId,
                },
              }),
          },
        };

        addSavedSettingList(currentData.settingCardData).catch(
          (error: unknown) => {
            console.error('startPracticeTest：処理失敗', error);
            throw new Error('データを保存リストに追加できませんでした');
          },
        );
        await setAnswerlingTestSettingData(currentData).catch(
          (error: unknown) => {
            console.error('startPracticeTest：処理失敗', error);
          },
        );
        setCurrentPlayData(currentData);
        readyForTest.setIsUser(true);
      }).catch((error: unknown) => {
        setIsDisabledInput(false).catch((error: unknown) => {
          console.error('startPracticeTest：処理失敗', error);
          if (error instanceof Error) {
            throw error;
          }

          throw new Error('不明なエラーが発生しました');
        });

        if (error instanceof Error) {
          console.error('startPracticeTest：処理失敗', error);
          throw new Error(
            `練習モード開始時にエラーが発生しました: ${error.message}`,
          );
        }

        throw new Error('練習モード開始時に不明なエラーが発生しました');
      });
    },
    [
      createTestDataDb,
      createTestPlayData,
      createTestDataNolist,
      setAnswerlingTestSettingData,
      setCurrentPlayData,
      readyForTest,
      setIsDisabledInput,
      getSettedTargetingTestData,
      addSavedSettingList,
      setQualifiedQuestionCount,
      setRequiredQuestionCount,
      initialExamQuestionSettingId,
      initialPracticeQuestionSetting,
    ],
  );
  const startExamTest = useCallback(
    async (id: string, catdData: SettingCardData) => {
      const _examSubjectCheckedIdList = catdData.examQuestionSetting.subject;
      if (_examSubjectCheckedIdList.length === 0) return;
      setIsDisabledInput(true, async () => {
        const _settingState = idToSettingState(id);
        const subjectKey =
          /_(subject[^_]+).*$/.exec(_examSubjectCheckedIdList[0])![1] ?? '';
        const numbers: Record<string, string> = {
          One: '学科Ⅰ',
          Two: '学科Ⅱ',
          Three: '学科Ⅲ',
          Four: '学科Ⅳ',
          Five: '学科Ⅴ',
        };

        const subjects: string[] = (() => {
          const keys = Object.keys(numbers);
          return keys
            .filter((key) => {
              return subjectKey.includes(key);
            })
            .map((v, _i) => {
              return numbers[v];
            });
        })();
        // console.log('subjects', subjects);

        // console.log('testDataList', testDataList);
        const targetList = subjects.flatMap((subject) => {
          return testDataList.filter((v) => v.subject === subject);
        });
        // console.log('targetList', targetList);
        const {testDataNoList, time} = createExamTestDataNolistAndTime(
          targetList,
          catdData.examQuestionSetting.numberOfQuestions[0],
        );
        const timeLimit = Number(time) * 60 * 1000;
        // console.log('testDataNoList', testDataNoList);
        const testPlayData = createTestPlayData(
          testDataNoList,
          timeLimit,
          id,
          idToSettingState(id),
          {
            _currentSelectedPracticeSettingIdList:
              initialPracticeQuestionSettingId,
            _currentSelectedExamSettingIdList: catdData.examQuestionSetting,
            _isQaa: false,
            _questionModeType: questionMode.exam,
          },
        );

        // firestoreにテストデータを送信
        const testPlayDataLog: TestPlayDataLog = {
          uid: getAuth(firestoreController.app).currentUser!.uid,
          controll: 'create',
          changeAt: Timestamp.now(),
          grade: testPlayData.settingCardData.grade,
          type: 'exam',
          isQaa: testPlayData.settingCardData.isQaa ?? false,
          ...testPlayData,
        };

        const testId = await createTestDataDb(testPlayDataLog).catch(
          (error: unknown) => {
            console.error('startExamTest：処理失敗', error);
            if (typeof error === 'string') throw new Error(error);
            throw new Error('不明なエラーがcreateTestDataDbで発生しました');
          },
        );
        const currentData: TestPlayData = {
          ...testPlayData,
          testId,
          settingCardData: {
            ...testPlayData.settingCardData,
            ...(_settingState === questionSettingState.task &&
              testPlayData.settingCardData.taskSetting && {
                taskSetting: {
                  ...testPlayData.settingCardData.taskSetting,
                  testId,
                },
              }),
          },
        };

        addSavedSettingList(currentData.settingCardData).catch(
          (error: unknown) => {
            console.error('startExamTest：処理失敗', error);
            throw new Error('データを保存リストに追加できませんでした');
          },
        );
        setCurrentPlayData(() => currentData);
        setAnswerlingTestSettingData(currentData).catch((error: unknown) => {
          console.error('startExamTest：処理失敗', error);
          if (typeof error === 'string')
            throw new Error(`テストデータ保存エラー:${error}`);
          throw new Error('テストデータ保存エラー');
        });
        readyForTest.setIsUser(true);
      }).catch((error: unknown) => {
        setIsDisabledInput(false).catch((error: unknown) => {
          console.error('startExamTest：処理失敗', error);
          if (typeof error === 'string') {
            console.error('startExamTest：処理失敗', error);
            throw new Error(
              `模擬試験モード開始時にエラーが発生しました: ${error}`,
            );
          }

          throw new Error('模擬試験モード開始時に不明なエラーが発生しました');
        });
        if (typeof error === 'string') {
          console.error('startExamTest：処理失敗', error);
          throw new Error(
            `模擬試験モード開始時にエラーが発生しました: ${error}`,
          );
        }

        throw new Error('模擬試験モード開始時に不明なエラーが発生しました');
      });
    },
    [
      createTestDataDb,
      createExamTestDataNolistAndTime,
      createTestPlayData,
      setAnswerlingTestSettingData,
      testDataList,
      setCurrentPlayData,
      readyForTest,
      setIsDisabledInput,
      addSavedSettingList,
      initialPracticeQuestionSettingId,
    ],
  );
  /**  isPracticeQuestionStartReservedがtrueの時、練習モード開始 */
  useEffect(() => {
    if (isPracticeQuestionStartReserved) {
      onPressStartPracticeTest()
        .then(() => {
          setIsPracticeQuestionStartReserved(false);
        })
        .catch((error: unknown) => {
          console.error('QuestionSettingViewContextProvider：処理失敗', error);
          setIsPracticeQuestionStartReserved(false);
        });
    }
  }, [
    isPracticeQuestionStartReserved,
    onPressStartPracticeTest,
    setIsPracticeQuestionStartReserved,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      currentSettingId,
      setCurrentSettingId,
      settingState,
      questionModeType,
      practiceSlides,
      examSlides,
      currentIndex,
      setCurrentIndex,
      slidesRef,
      scrollFoward,
      scrollBackward,
      onPressStartPracticeTest,
      onPressStartExamTest,
      startPracticeTest,
      startExamTest,
      ...practiceQuestionSetting,
      ...examQuestionSetting,
      ...saveSetting,
    };
  }, [
    currentSettingId,
    setCurrentSettingId,
    settingState,
    questionModeType,
    practiceSlides,
    examSlides,
    currentIndex,
    setCurrentIndex,
    slidesRef,
    scrollFoward,
    scrollBackward,
    onPressStartPracticeTest,
    onPressStartExamTest,
    practiceQuestionSetting,
    examQuestionSetting,
    saveSetting,
    startPracticeTest,
    startExamTest,
  ]);

  return (
    <QuestionSettingViewContext.Provider value={value}>
      {props.children}
    </QuestionSettingViewContext.Provider>
  );
};

export default QuestionSettingViewContextProvider;

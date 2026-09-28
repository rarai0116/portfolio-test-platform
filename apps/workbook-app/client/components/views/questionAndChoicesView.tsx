import {
  useContext,
  useEffect,
  useMemo,
  memo,
  useCallback,
  useRef,
  useState,
} from 'react';
import {useWindowDimensions} from 'react-native';
import {
  useNavigation,
  useIsFocused,
  CommonActions,
} from '@react-navigation/native';
import {TimeLimitContextProvider} from '../hooks/useTimeLimitContext';
import {answerMarkStates} from '../hooks/useGlobalSaveDataContext';
import Spacer from '../parts/spacer';
import Background from '../parts/background';
import QuestionDataPart from '../parts/questionDataPart';
import AnswerDataPart, {
  type AnswerDataPartProps,
} from '../parts/answerDataPart';
import {
  type ButtonInfo,
  CheckButtonStates,
} from '../hooks/useCheckButtonContext';
import {questionGrade, questionFormat} from '../../types/commonUnionType';
import ChoicesFooter from '../organisms/choicesFooter';
import {type TestViewsProps, allScreenIdList} from '../../types/viewParameter';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import CircleIcon from '../../assets/svg/circle_right-answer_big.svg';
import CrossIcon from '../../assets/svg/cross_wrong-answer_big.svg';
import tw from '../../tailwind.custom';
import SecondaryShortButtonWithArrowFooter from '../organisms/secondaryShortButtonWithArrowFooter';
import {ButtonStates} from '../hooks/useButtonContext';
import BasicModalWindow from '../parts/basicModalWindow';
import ModalManagerContextProvider, {
  ModalManagerContext,
} from '../hooks/useModalManagerContext';
import {
  QuestionAndChoicesViewContext,
  webViewState,
} from '../hooks/useQuestionsAndChoicesViewContext';
import BasicHalfModal from '../parts/basicHalfModal';
import {CrossHeaderButton} from '../organisms/headerButtons';
import SwitchQuestionBoxes from '../organisms/switchQuestionBoxes';
import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import ErrorReportFormViewModal from '../viewmodals/errorReportFormVIewModal';
import ErrorReporfFormAskSubmitModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormAskSubmitModal';
import ErrorReportFormSubmitCompletedModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormSubmitCompletedModal';
import ErrorReportFormSubmitFailedModal from '../viewmodals/errorReportFormVIewModal/organisms/errorReportFormSubmitFailedModal';

export type QuestionAndChoicesViewProps = Record<string, never>;

export const modalStates = {
  timeUp: 'qav-modal-timeUp', // 時間切れ
  quitTest: 'qav-modal-quitTest', // 途中終了
  pauseTest: 'qav-modal-pauseTest', // 中断
};

const PauseTestModal = memo(
  (props: {
    readonly onPressOutPrimaryButton: () => void;
    readonly onPressOutThirdlyButton: () => void;
  }) => {
    return (
      <BasicHalfModal
        title="中断しますか？"
        id={modalStates.pauseTest}
        primaryButtonText="保存して中断"
        thirdlyButtonText="キャンセル"
        hasInput={false}
        onPressOutPrimaryButton={props.onPressOutPrimaryButton}
        onPressOutThirdlyButton={props.onPressOutThirdlyButton}
      />
    );
  },
);

const InnerView = () => {
  const {width, height} = useWindowDimensions();
  const navigation =
    useNavigation<TestViewsProps<'QuestionAndChoicesView'>['navigation']>();
  const isFocused = useIsFocused();

  /**
   * Load Contexts
   */
  const {showModal, hideModal} = useContext(ModalManagerContext);
  const {
    grade,
    currentRecordKey,
    setCurrentPlayData,
    currentPlayData,
    readyForTest,
  } = useContext(GlobalUserSettingContext);
  // const {answerlingTestSettingData} = useContext(GlobalSaveDataContext);
  const {
    isAnswerMode,
    answerList,
    selectedAnswerList,
    currentPlayNo,
    isFinished,
    setIsFinished,
    setIsAborted,
    answerMark,
    limitTime,
    nextQuestionProcess,
    testFinishedProcess,
    isQaa,
    webViewTargetType,
    setWebViewTargetType,
    startTestProcess,
    handleFooterLayout,
    isQuitTest,
    selectAnswerlingTestChoice,
  } = useContext(QuestionAndChoicesViewContext);

  /** Defined Memos */
  const answerDataPartProps: AnswerDataPartProps = useMemo(() => {
    /*
    const seed = getSeed(currentPlayNo);
    const choicesArray = createChoicesArray(grade!, seed);
    const answerNo = answerList[currentPlayNo];
    const correctAnswer = String(choicesArray.indexOf(answerNo) + 1);
    */
    const correctAnswer = String(answerList[currentPlayNo]);

    const usersAnswer =
      selectedAnswerList[currentPlayNo] === 0
        ? '－'
        : String(selectedAnswerList[currentPlayNo]);
    const isCorrect = correctAnswer === usersAnswer;
    const buttonInfo: ButtonInfo = {
      id: 'request-report-bug',
      name: '報告',
      initialState: CheckButtonStates.disabled,
    };

    return {
      isQaa,
      correctAnswer,
      usersAnswer,
      isCorrect,
      buttonInfo,
    };
  }, [answerList, selectedAnswerList, currentPlayNo, isQaa]);
  const isDisabledChoiceButtonRef = useRef<boolean>(false);
  const [isDisabledFooterButton, setIsDisabledFooterButton] =
    useState<boolean>(false);

  // フッターのタイプ
  const footerType = useMemo(() => {
    if (isQaa) return questionFormat.qAndA;
    return grade === questionGrade.gradeOne
      ? questionFormat.fourChoices
      : questionFormat.fiveChoices;
  }, [isQaa, grade]);
  /** 時間切れモーダルウィンドウ */
  const timeUpModalWindow = useMemo(() => {
    return (
      <BasicModalWindow
        isBackDropPressFreeze
        title="時間切れになりました"
        id={modalStates.timeUp}
        primaryButtonText="結果画面へ"
        onPressOutPrimaryButton={() => {
          console.log('結果画面へ');
          hideModal();
          setIsFinished(true);
        }}
      />
    );
  }, [hideModal, setIsFinished]);

  /** 途中終了モーダル */
  const QuitTestModal = useMemo(() => {
    return (
      <BasicHalfModal
        title="終了して結果を見ますか？"
        id={modalStates.quitTest}
        primaryButtonText="終了"
        thirdlyButtonText="キャンセル"
        hasInput={false}
        onPressOutPrimaryButton={() => {
          console.log('結果画面へ');
          //          setIsQuitTest(false);
          hideModal(() => {
            setIsFinished(true);
          });
        }}
        onPressOutThirdlyButton={() => {
          //         setIsQuitTest(false);
          hideModal();
        }}
      />
    );
  }, [hideModal, setIsFinished]);

  /** Defined Modals */

  // テスト終了時に結果画面に遷移

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (isFinished && currentRecordKey) {
      console.log('テスト終了', isFinished);
      testFinishedProcess()
        .then(() => {
          navigation.navigate('QuestionResultView', {
            userId: allScreenIdList.QuestionResultView,
            footerButtonState: ButtonStates.released,
          });
        })
        .catch((error: unknown) => {
          console.error('テスト終了通信処理エラー', error);
          throw new Error('テスト終了通信処理エラー');
        });
    }
  }, [isFinished]);

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    startTestProcess().catch((error: unknown) => {
      console.error('テスト開始エラー', error);
    });
    navigation.setOptions({
      headerLeft() {
        return (
          <CrossHeaderButton
            color="#ffffff"
            buttonState={ButtonStates.released}
            onPressOut={() => {
              showModal(modalStates.pauseTest);
            }}
          />
        );
      },
    });
  }, [isFocused]);

  /** 「終了して結果画面をみる」を押したとき */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isQuitTest) {
      showModal(modalStates.quitTest);
      console.log('終了して結果画面をみる');
    }
  }, [isQuitTest]);
  /** 問題が更新されたとき、ボタンを押せる状態に戻す */
  const handleWebViewRendered = useCallback(() => {
    isDisabledChoiceButtonRef.current = false;
    setIsDisabledFooterButton(false);
  }, []);

  const pauseTestOnPressOutPrimaryButton = useCallback(() => {
    // if (answerlingTestSettingData === null) return;
    console.log('中断してホームへ');
    hideModal(() => {
      setIsAborted(true);
      testFinishedProcess()
        .then(() => {
          // navigation.getParent()?.setOptions({tabBarStyle: {}});
          setCurrentPlayData(() => null);
          readyForTest.initialize();
          navigation.getParent()?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: 'Tab',
                  params: {
                    userId: allScreenIdList.Tab,
                  },
                  state: {
                    routes: [
                      {
                        name: 'QuestionTab',
                        params: {
                          userId: allScreenIdList.QuestionTab,
                        },
                        state: {
                          routes: [
                            {
                              name: 'Home',
                              params: {
                                userId: allScreenIdList.Home,
                              },
                            },
                          ],
                          index: 0,
                        },
                      },
                    ],
                    index: 0, // QuestionTabを選択
                  },
                },
              ],
            }),
          );
        })
        .catch((error: unknown) => {
          console.error('中断処理後処理エラー', error);
        });
    });
  }, [
    hideModal,
    setIsAborted,
    setCurrentPlayData,
    testFinishedProcess,
    readyForTest,
    navigation,
  ]);

  const choicesFooterOnPress = useCallback(
    (number: number) => {
      if (currentPlayNo + 2 < selectedAnswerList.length) {
        setIsDisabledFooterButton(true);
        isDisabledChoiceButtonRef.current = true; // 選択肢ボタンを押せない状態にする
      }

      selectAnswerlingTestChoice(number, currentPlayNo);

      if (currentPlayNo === selectedAnswerList.length - 1) {
        // 最後の問題の解説画面ではバツボタンを非表示
        navigation.setOptions({
          headerLeft() {
            return undefined;
          },
        });
      }
    },
    [
      currentPlayNo,
      navigation,
      selectedAnswerList.length,
      selectAnswerlingTestChoice,
    ],
  );

  // if (!isFocused) return <Background />;
  return (
    <>
      <Background>
        <TextInputContextProvider>
          <ErrorReportFormViewModal />
          <ErrorReporfFormAskSubmitModal />
          <ErrorReportFormSubmitCompletedModal />
          <ErrorReportFormSubmitFailedModal />
        </TextInputContextProvider>
        <PauseTestModal
          onPressOutPrimaryButton={pauseTestOnPressOutPrimaryButton}
          onPressOutThirdlyButton={() => {
            hideModal();
          }}
        />
        {timeUpModalWindow}
        {QuitTestModal}

        <TimeLimitContextProvider
          durationTime={
            currentPlayData ? currentPlayData.durationTime : undefined
          }
          timeLimit={limitTime}
          onTimeLimitEnd={() => {
            showModal(modalStates.timeUp);
            // testFinishedProcess();
          }}
        >
          <QuestionDataPart />
        </TimeLimitContextProvider>
        <Spacer isHorizontal={false} size={12} />
        {isAnswerMode ? (
          <>
            <AnswerDataPart {...answerDataPartProps} />
            <Spacer isHorizontal={false} size={12} />
          </>
        ) : null}
        <SwitchQuestionBoxes
          handleWebViewRendered={handleWebViewRendered}
          onQuitTest={() => {
            showModal(modalStates.quitTest);
            console.log('終了して結果画面をみる');
          }}
        />
        {answerMark === answerMarkStates.correct && (
          <CircleIcon
            width={200}
            height={200}
            style={tw`absolute top-[${height / 2 - 200}px] left-[${
              width / 2 - 100
            }px]`}
          />
        )}
        {answerMark === answerMarkStates.wrong && (
          <CrossIcon
            width={180}
            height={180}
            style={tw`absolute top-[${height / 2 - 180}px] left-[${
              width / 2 - 90
            }px]`}
          />
        )}
      </Background>
      {isAnswerMode ? (
        <SecondaryShortButtonWithArrowFooter
          buttonText={
            webViewTargetType === webViewState.question
              ? '解説文を表示'
              : '問題文を表示'
          }
          onPressOutRightArrow={() => {
            nextQuestionProcess().catch((error: unknown) => {
              console.error('次の問題への遷移エラー', error);
            });
          }}
          onPressOutSecondaryButton={() => {
            if (webViewTargetType === webViewState.question)
              setWebViewTargetType(webViewState.answer);
            if (webViewTargetType === webViewState.answer)
              setWebViewTargetType(webViewState.question);
          }}
          onLayout={handleFooterLayout}
        />
      ) : (
        <ChoicesFooter
          type={footerType}
          isDisabled={
            isDisabledChoiceButtonRef.current || isDisabledFooterButton
          }
          onLayout={handleFooterLayout}
          onPress={(number) => {
            if (isDisabledChoiceButtonRef.current || isDisabledFooterButton)
              return;
            choicesFooterOnPress(number);
          }}
        />
      )}
    </>
  );
};

const QuestionAndChoicesView = (_props: QuestionAndChoicesViewProps) => {
  return (
    <ModalManagerContextProvider>
      <InnerView />
    </ModalManagerContextProvider>
  );
};

export default QuestionAndChoicesView;

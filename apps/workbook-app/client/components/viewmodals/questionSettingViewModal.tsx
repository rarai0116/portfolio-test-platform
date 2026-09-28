import {Keyboard, View, useWindowDimensions} from 'react-native';
import React, {useMemo, useContext, useCallback} from 'react';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import {
  questionMode,
  questionSettingState,
  questionSettingModalStates,
} from '../../types/commonUnionType';
import {InitialSettingDataContext} from '../hooks/useInitialSettingDataContext';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import PracticeQuestionSettingModal from '../organisms/practiceQuestionSettingModal';
import HalfModal from '../identities/halfModal';
import BackButton from '../parts/backButton';
import PrimaryShortButton from '../parts/primaryShortButton';
import NextButton from '../parts/nextButton';
import tw from '../../tailwind.custom';
import ExamQuestionSettingModal from '../organisms/examQuestionSettingModal';
import {modalHeaderRight} from '../parts/halfModalHeader';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';
import QuestionSettingAskInitialSaveSettingModal from '../organisms/questionSettingAskInitialSaveSettingModal';
import QuestionSettingAskSaveSettingModal from '../organisms/questionSettingAskSaveSettingModal';
import QuestionSettingOverwriteCompletedModal from '../organisms/questionSettingOverwriteCompletedModal';
import QuestionSettingSaveAsNewCompletedModal from '../organisms/questionSettingSaveAsNewCompletedModal';
import QuestionSettingSaveAsNewTextInputModal from '../organisms/questionSettingSaveAsNewTextInputModal';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import {TaskDataContext} from '../hooks/useTaskDataContext';

export type InnerViewProps = Record<string, never>;

const MemorizedPracticeQuestionSettingModal = React.memo(
  PracticeQuestionSettingModal,
);
const MemorizedExamQuestionSettingModal = React.memo(ExamQuestionSettingModal);

const InnerView = () => {
  const {setIsDisabledInput} = useContext(GlobalUserSettingContext);
  const {hideModal, showModal} = useContext(ModalManagerContext);
  const {
    settingState,
    questionModeType,
    questionTimeInfo,
    questionNumberOfQuestionsInfo,
    questionDifficultiesInfo,
    currentIndex,
    scrollFoward,
    scrollBackward,
    practiceSlides,
    examSlides,
    onPressStartPracticeTest,
    onPressStartExamTest,
    checkedCategoryButtonIdList,
    currentSettingId,
  } = useContext(QuestionSettingViewContext);
  const {taskSettingList} = useContext(TaskDataContext);

  const {initialPracticeQuestionSetting} = useContext(
    InitialSettingDataContext,
  );
  const startTest = useCallback(() => {
    if (
      taskSettingList[currentSettingId].questionMode === questionMode.practice
    ) {
      // 練習モード新規作成
      onPressStartPracticeTest()
        .then(() => {
          console.log('課題->練習モードテスト開始');
        })
        .catch((error: unknown) => {
          console.error('error', error);
          if (error instanceof Error) {
            if (error.message.includes('E1'))
              showModal(questionSettingModalStates.noQuestionSettingCondition);
            else if (error.message.includes('E2'))
              showModal(
                questionSettingModalStates.notEnoughQuestionSettingCondition,
              );
            else showModal(questionSettingModalStates.QuestionStartFailed);
            console.error('startTest：処理失敗', error);
          }
        });
    } else {
      // 模擬試験モード新規作成
      onPressStartExamTest()
        .then(() => {
          console.log('模擬試験モードテスト開始');
        })
        .catch((error: unknown) => {
          console.error('startTest：処理失敗', error);
        });
    }
  }, [
    onPressStartPracticeTest,
    onPressStartExamTest,
    currentSettingId,
    taskSettingList,
    showModal,
  ]);
  /* 「次へ」ボタンの状態**/
  const practiceNextButtonState = useMemo(() => {
    const _checkedCategoryIdList = checkedCategoryButtonIdList;
    if (
      (currentIndex === 0 &&
        questionDifficultiesInfo.checkedList.length === 0) ||
      currentIndex === 1 ||
      (currentIndex === 2 && _checkedCategoryIdList.length === 0) ||
      (currentIndex === 3 && // 問題数未入力、または制限時間入力を選択かつ未入力の場合
        (questionNumberOfQuestionsInfo.selectedValue === '' ||
          questionNumberOfQuestionsInfo.selectedValue === '0' ||
          (initialPracticeQuestionSetting.questionTime[1].id.includes(
            questionTimeInfo.checkedIdList[0],
          ) &&
            questionTimeInfo.selectedValue === '')))
    ) {
      return ButtonStates.disabled;
    }

    return ButtonStates.released;
  }, [
    currentIndex,
    checkedCategoryButtonIdList,
    questionDifficultiesInfo.checkedList,
    questionNumberOfQuestionsInfo.selectedValue,
    questionTimeInfo,
    initialPracticeQuestionSetting,
  ]);

  const practiceFooter = useMemo(() => {
    switch (currentIndex) {
      case 0: {
        return (
          <>
            <View style={tw`h-5`} />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
              }}
            />
          </>
        );
      }

      case 1: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <View style={tw`h-5`} />
          </>
        );
      }

      case 3: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
                if (currentIndex === 3) {
                  Keyboard.dismiss();
                }
              }}
            />
          </>
        );
      }

      case practiceSlides.length - 1: {
        return (
          <>
            {settingState === questionSettingState.initial ? (
              <BackButton onPressOut={scrollBackward} />
            ) : (
              <View />
            )}
            <ButtonContextProvider
              state={ButtonStates.released}
              onPressOut={() => {
                // Call hideModal and then execute the callback logic

                /* 出題開始ボタン押下時の処理
                  [エラーメッセージ]
                  E1: 条件に合う問題が一問もない
                  E2: 条件に合う問題が1問以上設定問題数未満
                  その他: 不明なエラーで出題開始失敗
                  */
                hideModal();
                onPressStartPracticeTest().catch((error: unknown) => {
                  console.error('callback error', error);
                  if (error instanceof Error) {
                    if (error.message.includes('E1'))
                      showModal(
                        questionSettingModalStates.noQuestionSettingCondition,
                      );
                    else if (error.message.includes('E2'))
                      showModal(
                        questionSettingModalStates.notEnoughQuestionSettingCondition,
                      );
                    else
                      showModal(questionSettingModalStates.QuestionStartFailed);
                    console.error('practiceFooter：処理失敗', error);
                  } else {
                    showModal(questionSettingModalStates.QuestionStartFailed);
                    console.error('practiceFooter：処理失敗', error);
                  }

                  setIsDisabledInput(false).catch((error: unknown) => {
                    console.error('error', error);
                    throw new Error('Failed to enable input');
                  });
                });
              }}
            >
              <View style={tw`mr-3`}>
                <PrimaryShortButton text="出題開始" />
              </View>
            </ButtonContextProvider>
          </>
        );
      }

      default: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
              }}
            />
          </>
        );
      }
    }
  }, [
    hideModal,
    showModal,
    currentIndex,
    practiceNextButtonState,
    practiceSlides,
    scrollBackward,
    scrollFoward,
    settingState,
    onPressStartPracticeTest,
    setIsDisabledInput,
  ]);

  const examFooter = useMemo(() => {
    switch (currentIndex) {
      case 0: {
        return (
          <>
            <View style={tw`h-18`} />
            <View style={tw`h-18`} />
          </>
        );
      }

      case 1: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <View style={tw`h-5`} />
          </>
        );
      }

      case examSlides.length - 1: {
        return (
          <>
            {settingState === questionSettingState.initial ? (
              <BackButton onPressOut={scrollBackward} />
            ) : (
              <View />
            )}
            <ButtonContextProvider
              state={ButtonStates.released}
              onPressOut={async () => {
                setIsDisabledInput(true, async () => {
                  return new Promise<void>((resolve) => {
                    hideModal(() => {
                      onPressStartExamTest().catch((error: unknown) => {
                        showModal(
                          questionSettingModalStates.QuestionStartFailed,
                        );
                        console.error('examFooter：処理失敗', error);
                      });
                      resolve();
                    });
                  });
                }).catch((error: unknown) => {
                  console.error('error', error);
                  if (error instanceof Error) {
                    showModal(questionSettingModalStates.QuestionStartFailed);
                    console.error('examFooter：処理失敗', error);
                  } else {
                    showModal(questionSettingModalStates.QuestionStartFailed);
                    console.error('examFooter：処理失敗', error);
                  }

                  setIsDisabledInput(false).catch((error: unknown) => {
                    console.error('error', error);
                    throw new Error('Failed to enable input');
                  });
                });
              }}
            >
              <View style={tw`mr-3`}>
                <PrimaryShortButton text="出題開始" />
              </View>
            </ButtonContextProvider>
          </>
        );
      }

      default: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <NextButton
              buttonState={ButtonStates.released}
              onPressOut={() => {
                scrollFoward(examSlides);
              }}
            />
          </>
        );
      }
    }
  }, [
    hideModal,
    showModal,
    setIsDisabledInput,
    currentIndex,
    examSlides,
    scrollBackward,
    scrollFoward,
    settingState,
    onPressStartExamTest,
  ]);
  const modal = useMemo(() => {
    if (questionModeType === questionMode.practice) {
      return <MemorizedPracticeQuestionSettingModal />;
    }

    return <MemorizedExamQuestionSettingModal />;
  }, [questionModeType]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const footer = useMemo(() => {
    // なぜか保存モードでpaddingが必要になる
    //ややこしくってしまった...
    const isPractice = questionModeType === questionMode.practice;

    const baseClass = 'w-full flex-row bg-white px-5 items-center';

    const justifyClass =
      settingState === questionSettingState.initial
        ? 'justify-between'
        : 'justify-center';

    const paddingClass =
      settingState === questionSettingState.saved ||
      settingState === questionSettingState.previous ||
      settingState === questionSettingState.categoryDataAnalysis
        ? 'py-3'
        : '';

    const content = isPractice ? practiceFooter : examFooter;

    return (
      <View style={tw`${baseClass} ${justifyClass} ${paddingClass}`}>
        {content}
      </View>
    );
  }, [settingState, questionModeType, practiceFooter, examFooter, startTest]);

  return (
    <>
      {modal}
      {footer}
    </>
  );
};

export type QuestionSettingViewModalProps = {readonly id: string};
const QuestionSettingViewModal = (props: QuestionSettingViewModalProps) => {
  const {height} = useWindowDimensions();
  const {
    questionModeType,
    settingState,
    saveFolderButtonColor,
    saveFolderButtonState,
    currentIndex,
    practiceSlides,
    examSlides,
  } = useContext(QuestionSettingViewContext);
  const {showModalLikeView} = useContext(ModalLikeViewManagerContext);

  const modalHeaderRightButton = useMemo(() => {
    if (
      settingState !== questionSettingState.initial ||
      (questionModeType === questionMode.practice &&
        currentIndex !== practiceSlides.length - 1) ||
      (questionModeType === questionMode.exam &&
        currentIndex !== examSlides.length - 1)
    ) {
      return modalHeaderRight.none;
    }

    return modalHeaderRight.save;
  }, [
    settingState,
    currentIndex,
    practiceSlides,
    examSlides,
    questionModeType,
  ]);

  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={props.id}
      style={`bg-white
      ${questionModeType === questionMode.exam ? `h-[${height / 2}px]` : `h-[${height}px]`} `}
      modalHeaderRightButton={modalHeaderRightButton}
      rightButtonStates={saveFolderButtonState}
      rightButtonColor={saveFolderButtonColor}
      onPressOutRightButton={() => {
        if (
          settingState === questionSettingState.initial ||
          settingState === questionSettingState.previous
        ) {
          showModalLikeView(questionSettingModalStates.askInitialSaveSetting);
        } else if (settingState === questionSettingState.saved) {
          showModalLikeView(questionSettingModalStates.askSaveSetting);
        }
      }}
    >
      <TextInputContextProvider>
        <QuestionSettingAskInitialSaveSettingModal />
        <QuestionSettingAskSaveSettingModal />
        <QuestionSettingOverwriteCompletedModal />
        <QuestionSettingSaveAsNewCompletedModal />
        <QuestionSettingSaveAsNewTextInputModal />
      </TextInputContextProvider>
      <InnerView />
    </HalfModal>
  );
};

export default QuestionSettingViewModal;

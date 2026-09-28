import {summarizeConsoleValue} from '../../../functionals/consoleLevels';
import {useCallback, useContext, useMemo} from 'react';
import {View} from 'react-native-animatable';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';
import {QuestionSettingViewContext} from '@/components/hooks/useQuestionSettingViewContext';
import {TaskDataContext} from '@/components/hooks/useTaskDataContext';
import {
  questionMode,
  questionSettingModalStates,
  questionState,
} from '@/types/commonUnionType';
import tw from '@/tailwind.custom';
import {ButtonContextProvider} from '@/components/hooks/useButtonContext';
import PrimaryShortButton from '@/components/parts/primaryShortButton';
import {getTestData} from '@/components/functionals/firestoreController';
import {QuestionAndChoicesViewContext} from '@/components/hooks/useQuestionsAndChoicesViewContext';

type StartCalndarTaskFooterProps = Record<string, never>;

const StartCalndarTaskFooter = (_props: StartCalndarTaskFooterProps) => {
  const {readyForTest, setIsDisabledInput, isLoading} = useContext(
    GlobalUserSettingContext,
  );
  const {initializePlayData} = useContext(QuestionAndChoicesViewContext);
  const {showModal} = useContext(ModalManagerContext);
  const {taskSettingList} = useContext(TaskDataContext);
  const {onPressStartPracticeTest, onPressStartExamTest} = useContext(
    QuestionSettingViewContext,
  );
  const {taskSaveButtonState, currentTaskSettingCardId} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  const footerText = useMemo(() => {
    if (!currentTaskSettingCardId) return '';
    if (!taskSettingList?.[currentTaskSettingCardId]?.taskSetting) return '';
    return taskSettingList[currentTaskSettingCardId].taskSetting?.taskState ===
      questionState.progress
      ? '課題を再開'
      : '課題を開始';
  }, [taskSettingList, currentTaskSettingCardId]);

  const onPressOut = useCallback(() => {
    if (!currentTaskSettingCardId)
      throw new Error('currentTaskSettingCardId is null');

    if (taskSettingList[currentTaskSettingCardId].taskSetting?.testId) {
      if (isLoading) return;
      console.log(
        '課題を再開',
        summarizeConsoleValue(
          taskSettingList[currentTaskSettingCardId].taskSetting?.testId,
        ),
      );
      readyForTest.initialize();
      setIsDisabledInput(true, async () => {
        try {
          const testId =
            taskSettingList[currentTaskSettingCardId].taskSetting?.testId;
          if (!testId) throw new Error('testId is null');
          const data = await getTestData(testId);
          if (data.status !== 'success' || !data.testPlayDataLog) {
            console.error('カレンダー課題の再開データが存在しません');
            throw new Error('カレンダー課題の再開データが存在しません');
          }

          console.log(
            'データ取得成功',
            summarizeConsoleValue(data.testPlayDataLog),
          );
          await initializePlayData(data.testPlayDataLog);
          readyForTest.setIsUser(true);
        } catch (error: unknown) {
          console.error('onPressOut：カレンダー課題再開失敗', error);
          readyForTest.initialize();
          await setIsDisabledInput(false);
          showModal(questionSettingModalStates.QuestionStartFailed);
        }
      }).catch((error: unknown) => {
        console.error('onPressOut：処理失敗', error);
        readyForTest.initialize();
        setIsDisabledInput(false).catch((unlockError: unknown) => {
          console.error('onPressOut：入力ロック解除失敗', unlockError);
        });
        showModal(questionSettingModalStates.QuestionStartFailed);
      });
    } else if (
      taskSettingList[currentTaskSettingCardId].questionMode ===
      questionMode.practice
    ) {
      // 練習モード新規作成
      onPressStartPracticeTest(currentTaskSettingCardId)
        .then(() => {
          console.log('カレンダー->練習モードテスト開始');
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
            console.error('onPressOut：処理失敗', error);
          } else {
            showModal(questionSettingModalStates.QuestionStartFailed);
            console.error('onPressOut：処理失敗', error);
          }
        });
    } else {
      // 模擬試験モード新規作成
      onPressStartExamTest(currentTaskSettingCardId)
        .then(() => {
          console.log('模擬試験モードテスト開始');
        })
        .catch((error: unknown) => {
          console.error('onPressOut：処理失敗', error);
        });
    }
  }, [
    currentTaskSettingCardId,
    taskSettingList,
    initializePlayData,
    readyForTest,
    onPressStartPracticeTest,
    onPressStartExamTest,
    setIsDisabledInput,
    showModal,
    isLoading,
  ]);

  return (
    <View style={tw`py-4 items-center`}>
      <ButtonContextProvider
        state={taskSaveButtonState}
        onPressOut={onPressOut}
      >
        <PrimaryShortButton text={footerText} />
      </ButtonContextProvider>
    </View>
  );
};

export default StartCalndarTaskFooter;

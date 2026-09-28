import {summarizeConsoleValue} from '../../functionals/consoleLevels';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {useWindowDimensions} from 'react-native';
import {useContext, useCallback} from 'react';
import {ModalManagerContext} from '@hooks/useModalManagerContext';
import {TaskDataContext} from '@hooks/useTaskDataContext';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import {QuestionSettingViewContext} from '@hooks/useQuestionSettingViewContext';
import {getTestData} from '@functionals/firestoreController';
import {
  questionState,
  taskSettingModalStates,
} from '../../../types/commonUnionType';
import CompletedTaskModal from '../../organisms/completedTaskModal';
import UnableToAnswerTaskModal from '../../organisms/unableToAnswerTaskModal';
import TaskPreviewModal from './organisms/taskPreviewModal';
import TaskSecondaryTodayTabs from './organisms/taskSecondaryTodayTab';
import TaskSecondaryUserTab from './organisms/taskSecondaryUserTab';
import TaskSecondaryTeacherTab from './organisms/taskSecondaryTeacherTab';
import {TaskModeViewContext} from './hooks/useTaskModeViewContext';
import FailedStartTestModals from '@/components/organisms/failedStartTestModal';
import {questionMode} from '@/types/commonUnionType';
import {questionSettingModalStates} from '@/types/commonUnionType';
import {ButtonStates} from '@/components/hooks/useButtonContext';
import {QuestionAndChoicesViewContext} from '@/components/hooks/useQuestionsAndChoicesViewContext';

const TaskModeMainView = () => {
  const Tab = createMaterialTopTabNavigator();
  const layout = useWindowDimensions();
  const {selectedTaskData} = useContext(TaskModeViewContext);
  const {hideModal, showModal} = useContext(ModalManagerContext);
  const {taskSettingList: _taskSettingList} = useContext(TaskDataContext);
  const {startExamTest, startPracticeTest} = useContext(
    QuestionSettingViewContext,
  );
  const {readyForTest, setIsDisabledInput, isLoading} = useContext(
    GlobalUserSettingContext,
  );
  const {initializePlayData} = useContext(QuestionAndChoicesViewContext);

  const startTest = useCallback(() => {
    if (!selectedTaskData) return;
    if (selectedTaskData.questionMode === questionMode.practice) {
      // 練習モード新規作成
      startPracticeTest(selectedTaskData.id, selectedTaskData)
        .then(() => {
          console.log('練習モードテスト開始');
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
          } else {
            showModal(questionSettingModalStates.QuestionStartFailed);
            console.error('startTest：処理失敗', error);
          }
        });
    } else {
      // 模擬試験モード新規作成
      startExamTest(selectedTaskData.id, selectedTaskData)
        .then(() => {
          console.log('模擬試験モードテスト開始');
        })
        .catch((error: unknown) => {
          showModal(questionSettingModalStates.QuestionStartFailed);
          console.error('startTest：処理失敗', error);
        });
    }
  }, [startPracticeTest, startExamTest, selectedTaskData, showModal]);
  const onPressOut = useCallback(() => {
    if (!selectedTaskData) throw new Error('selectedTaskData is null');
    if (selectedTaskData.taskSetting?.testId) {
      if (isLoading) return;
      readyForTest.initialize();
      setIsDisabledInput(true, async () => {
        try {
          console.log(
            '課題を再開',
            summarizeConsoleValue(selectedTaskData.taskSetting?.testId),
          );
          const testId = selectedTaskData.taskSetting?.testId;
          if (!testId) throw new Error('testId is null');
          const data = await getTestData(testId);
          if (data.status !== 'success' || !data.testPlayDataLog) {
            console.error('課題の再開データが存在しません');
            throw new Error('課題の再開データが存在しません');
          }

          console.log(
            'データ取得成功',
            summarizeConsoleValue(data.testPlayDataLog),
          );
          await initializePlayData(data.testPlayDataLog);
          hideModal(() => {
            readyForTest.setIsUser(true);
          });
        } catch (error: unknown) {
          console.error('onPressOut：課題再開失敗', error);
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
    } else {
      console.log('課題開始要求', selectedTaskData.id);
      hideModal(() => {
        startTest();
      });
    }
  }, [
    hideModal,
    selectedTaskData,
    initializePlayData,
    startTest,
    setIsDisabledInput,
    readyForTest,
    showModal,
    isLoading,
  ]);
  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarIndicatorStyle: {backgroundColor: '#289DF4', height: 1},
          tabBarStyle: {backgroundColor: 'white'},
          tabBarInactiveTintColor: '#3F3F3F',
          tabBarActiveTintColor: '#289DF4',
          tabBarPressColor: 'transparent',
          tabBarScrollEnabled: false,
          tabBarAllowFontScaling: false,
          animationEnabled: false,
        }}
        initialRouteName="今日"
        initialLayout={{width: layout.width}}
        tabBarPosition="top"
      >
        <Tab.Screen name="今日" component={TaskSecondaryTodayTabs} />
        <Tab.Screen name="あなた" component={TaskSecondaryUserTab} />
        <Tab.Screen name="講師からの課題" component={TaskSecondaryTeacherTab} />
      </Tab.Navigator>
      <TaskPreviewModal
        id={taskSettingModalStates.viewModal}
        buttonState={
          selectedTaskData?.taskSetting?.taskState === questionState.completed
            ? ButtonStates.disabled
            : ButtonStates.released
        }
        onPressOut={onPressOut}
      />
      <CompletedTaskModal />
      <UnableToAnswerTaskModal />
      <FailedStartTestModals
        notEnoughQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
          onPressOutCancelButton() {},
        }}
        noQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
        }}
        questionStartFailedModalProps={{
          onPressOutCloseButton() {},
        }}
      />
    </>
  );
};

export default TaskModeMainView;

import {useNavigation, CommonActions} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import {useContext, useMemo, useEffect} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {View} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {
  allScreenIdList,
  type CalendarModalList,
  type RootViewsProps,
} from '../../types/viewParameter';
import HalfModalHeader, {modalHeaderRight} from '../parts/halfModalHeader';
import PracticeQuestionSettingViewModal from '../viewmodals/practiceQuestionSettingViewModal';
import ExamQuestionSettingViewModal from '../viewmodals/examQuestionSettingViewModal';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';
import {
  calendarTaskSettingModalStates,
  taskAuthor,
  taskSettingMode,
} from '../../types/commonUnionType';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import FailedStartTestModals from '../organisms/failedStartTestModal';
import SavedSetting from './calendarView/organisms/calendarSavedSetting';
import CalendarTaskSettingViewModal from './calendarView/viewModals/calendarTaskSettingViewModal';
import CalendarSelectQuestionModeViewModal from './calendarView/viewModals/calendarSelectQuestionModeViewModal';
import {CalendarTaskSettingViewModalContext} from './calendarView/hooks/useCalendarTaskSettingViewModalContext';
import DiscardChangesModal from './calendarView/organisms/discardChangesModal';
import NotSetTaskSettingModal from './calendarView/organisms/notSetTaskSettingModal';
import TaskSettingAskSaveModal from './calendarView/organisms/taskSettingAskSaveModal';
import TaskSettingSaveCompletedModal from './calendarView/organisms/taskSettingSaveCompletedModal';
import AskDeleteTaskSettingModal from './calendarView/organisms/askDeleteTaskSettingModal';
import tw from '@/tailwind.custom';

export type CalendarSettingModalContainerProps = Record<string, never>;

const CalendarSettingModalContainer = (
  _props: CalendarSettingModalContainerProps,
) => {
  const isFocused = useIsFocused();
  const {top} = useSafeAreaInsets();
  const stack = createStackNavigator<CalendarModalList>();
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {setIsInCalendarTaskSetting} = useContext(QuestionSettingViewContext);
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  const {
    isEqualToInitialSetting,
    calendarTaskSettingMode,
    currentTaskSettingCardId,
    temporaryTaskSetting,
  } = useContext(CalendarTaskSettingViewModalContext);
  const {setTargetSavedSettingId} = useContext(GlobalSaveDataContext);
  const {readyForTest, setIsDisabledInput} = useContext(
    GlobalUserSettingContext,
  );
  const screenOptions: StackNavigationOptions = useMemo(() => {
    return {
      presentation: 'transparentModal',
      headerShown: true,
      headerTitle: '',
      cardOverlayEnabled: true,
      gestureEnabled: false,
      cardStyle: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }, // headerとbodyの間のボーダーを消す
      freezeOnBlur: true,
      header({route, navigation, options: _options, back: _back}) {
        const isCalendarTaskSetting = route.name === 'CalendarTaskSetting';
        return (
          <HalfModalHeader
            rightButtonType={
              isCalendarTaskSetting &&
              calendarTaskSettingMode === taskSettingMode.edit &&
              temporaryTaskSetting.taskSetting?.author === taskAuthor.user
                ? modalHeaderRight.delete
                : modalHeaderRight.none
            }
            onPressOutRightButton={() => {
              showModalLikeView(calendarTaskSettingModalStates.askDelete);
              if (currentTaskSettingCardId === undefined)
                throw new Error('currentTaskSettingCardId is null');
              setTargetSavedSettingId(currentTaskSettingCardId);
            }}
            onPressOutCrossButton={() => {
              if (calendarTaskSettingMode === taskSettingMode.save) {
                if (isEqualToInitialSetting) {
                  setIsInCalendarTaskSetting(false);
                  hideModalLikeView();
                  navigation.getParent()?.goBack();
                } else {
                  showModalLikeView(
                    calendarTaskSettingModalStates.discardChanges,
                  );
                }
              } else {
                navigation.getParent()?.goBack();
              }
            }}
          />
        );
      },

      ...TransitionPresets.SlideFromRightIOS, // ここで右から左へ
    };
  }, [
    calendarTaskSettingMode,
    isEqualToInitialSetting,
    temporaryTaskSetting.taskSetting?.author,
    currentTaskSettingCardId,
    setIsInCalendarTaskSetting,
    showModalLikeView,
    hideModalLikeView,
    setTargetSavedSettingId,
  ]);
  // テスト開始チェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    console.log('カレンダー→テスト開始チェック', readyForTest);
    if (!readyForTest.isComplete) return;
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Test',
            params: {
              userId: allScreenIdList.Test,
              screen: 'QuestionAndChoicesView',
              params: {
                userId: allScreenIdList.QuestionAndChoicesView,
              },
            },
          },
        ],
      }),
    );
    setIsDisabledInput(false);
  }, [readyForTest.isComplete]);

  return (
    <View style={tw`flex-1 pt-[${top / 2}px]`}>
      <DiscardChangesModal />
      <NotSetTaskSettingModal />
      <TaskSettingAskSaveModal />
      <TaskSettingSaveCompletedModal />
      <AskDeleteTaskSettingModal />
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
      {/* <DeleteTaskSettingCompletedModal /> */}
      <stack.Navigator screenOptions={screenOptions}>
        <stack.Screen
          name="CalendarTaskSetting"
          component={CalendarTaskSettingViewModal}
        />
        <stack.Screen
          name="SelectQuestionMode"
          component={CalendarSelectQuestionModeViewModal}
        />
        <stack.Screen
          name="PracticeQuestionSetting"
          component={PracticeQuestionSettingViewModal}
        />
        <stack.Screen
          name="ExamQuestionSetting"
          component={ExamQuestionSettingViewModal}
        />
        <stack.Screen name="SavedSetting" component={SavedSetting} />
      </stack.Navigator>
    </View>
  );
};

export default CalendarSettingModalContainer;

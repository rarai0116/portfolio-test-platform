import {View, useWindowDimensions} from 'react-native';
import {useCallback, useMemo, useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import Spacer from '../../../parts/spacer';
import TaskStateBadge from '../../../parts/taskStateBadge';
import EyeglassIcon from '../../../../assets/svg/eyeglasses_task-by-teacher-icon.svg';
import AlertIcon from '../../../../assets/svg/exclamation-mark_alert-icon.svg';
import {settingCardModalStates} from '../../../../types/commonUnionType';
import {
  allScreenIdList,
  type RootViewsProps,
} from '../../../../types/viewParameter';
import {getTimeString} from '../../../functionals/timeManager';
import {TaskDataContext} from '../../../hooks/useTaskDataContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';

export type CalendarTaskListProps = {
  readonly id: string;
};
const TOUCH_THRESHOLD = 15; // タッチ移動閾値

const CalendarTaskList = (props: CalendarTaskListProps) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();

  const {taskSettingList} = useContext(TaskDataContext);
  const {showModal} = useContext(ModalManagerContext);
  const {initializeCalendarTaskSetting, saveTaskSettingRef} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const {initializeQuestionInfo} = useContext(QuestionSettingViewContext);
  const cardData = useMemo(() => {
    const key = props.id;
    return taskSettingList[key];
  }, [props.id, taskSettingList]);

  /*
  useEffect(() => {
    console.log(cardData);
  }, [cardData]);
  */

  const {width} = useWindowDimensions();
  // タイトルの幅＝リストの幅－他の要素,余白の幅
  const titleTextWidth = `w-[${(width * 11) / 12 - 188}px]`;

  const taskCalendarColor: string = useMemo(() => {
    if (cardData === null) return 'bg-quaternary';
    return `${cardData.taskSetting?.taskCalendarColor}`;
  }, [cardData]);

  const titleColor: string = useMemo(() => {
    if (cardData === null) return 'text-primary';
    return cardData.taskSetting?.isExpired
      ? 'text-errorred-400'
      : 'text-primary';
  }, [cardData]);

  const bgColor: string = useMemo(() => {
    if (cardData === null) return 'bg-white';
    return cardData.taskSetting?.isExpired ? 'bg-errorred-50' : 'bg-white';
  }, [cardData]);

  const _displayAlertIcon = useMemo(() => {
    if (!cardData.taskSetting) return null;
    if (!cardData.taskSetting.isOpen && cardData.taskSetting.isTeacher) {
      return <AlertIcon />;
    }

    return null;
  }, [cardData]);
  const onPressOut = useCallback(() => {
    if (!cardData?.taskSetting) return;
    if (!cardData.title) return;
    const {taskSetting} = cardData;
    saveTaskSettingRef.current = {
      title: cardData.title,
      taskDate: taskSetting.taskDate,
      taskColor: taskSetting.taskCalendarColor,
    };

    if (taskSetting.hasTask) {
      if (taskSetting.isExpired && !taskSetting.isAbleToAnswerAfterDeadline) {
        showModal(settingCardModalStates.unableToAnswerModal);
      } else {
        initializeQuestionInfo();
        initializeCalendarTaskSetting(cardData, props.id, () => {
          navigation.navigate('ModalStack', {
            userId: allScreenIdList.ModalStack,
            screen: 'CalendarTaskSetting',
            params: {
              userId: allScreenIdList.CalendarTaskSetting,
              isReloadCurrentSettingId: false,
            },
          });
        });
      }
    } else {
      initializeCalendarTaskSetting(cardData, props.id, () => {
        navigation.navigate('ModalStack', {
          userId: allScreenIdList.ModalStack,
          screen: 'CalendarTaskSetting',
          params: {
            userId: allScreenIdList.CalendarTaskSetting,
            isReloadCurrentSettingId: false,
          },
        });
      });
    }
  }, [
    cardData,
    showModal,
    initializeCalendarTaskSetting,
    initializeQuestionInfo,
    navigation,
    props.id,
    saveTaskSettingRef,
  ]);
  const gesture = Gesture.Tap()
    .maxDistance(TOUCH_THRESHOLD)
    .maxDuration(500)
    .onBegin(() => {})
    .onEnd((_event) => {
      runOnJS(onPressOut)();
    });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const timeString = useMemo(() => {
    if (!cardData) return '';
    if (!cardData.taskSetting) return '';
    if (!cardData.taskSetting.deadlineDate) return '';
    return getTimeString(cardData.taskSetting.deadlineDate);
  }, [cardData?.taskSetting?.deadlineDate]);
  return (
    <GestureDetector gesture={gesture}>
      <View style={tw`w-11/12 ${bgColor} rounded-md px-4 py-2`}>
        <View style={tw`w-full flex-row justify-between`}>
          <View
            style={tw`w-[${(width * 11) / 12 - 136}px] flex-row items-center`}
          >
            <View style={tw`w-1 h-8 rounded ${taskCalendarColor}`} />
            <Spacer isHorizontal size={8} />
            {cardData.taskSetting?.deadlineDate && (
              <View style={tw`w-[32px] items-center`}>
                <AppText style={tw`text-primary text-xs`}>{timeString}</AppText>
                <AppText style={tw`text-primary text-xs`}>まで</AppText>
              </View>
            )}

            <Spacer isHorizontal size={8} />

            <AppText
              style={tw`${titleTextWidth} ${titleColor}  text-base`}
              numberOfLines={1}
            >
              {cardData.title}
            </AppText>
          </View>
          <Spacer isHorizontal size={8} />
          <View style={tw`flex-row items-center`}>
            {cardData.taskSetting?.isTeacher && (
              <EyeglassIcon width={24} height={24} style={tw``} />
            )}
            <Spacer isHorizontal size={4} />
            {cardData.taskSetting?.taskState && (
              <TaskStateBadge state={cardData.taskSetting.taskState} />
            )}
            <Spacer isHorizontal size={4} />
          </View>
        </View>
      </View>
    </GestureDetector>
  );
};

export default CalendarTaskList;

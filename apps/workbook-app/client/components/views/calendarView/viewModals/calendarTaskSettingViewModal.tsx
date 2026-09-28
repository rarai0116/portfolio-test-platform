import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useContext, useMemo, useRef} from 'react';
import {useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AccordionMenuContextProvider} from '../../../hooks/useAccordionMenuContext';
import {TextInputContextProvider} from '../../../hooks/useTextInputContextProvider';
import Spacer from '../../../parts/spacer';
import AppText from '../../../identities/appText';
import tw from '../../../../tailwind.custom';
import PenIcon from '../../../../assets/svg/pen_common.svg';
import TaskCalendar from '../organisms/taskCalendar';
import TaskTitleTextInput from '../organisms/taskTitleTextInput';
import TaskColor from '../organisms/taskColor';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {CustomCalendarContextProvider} from '../hooks/useCustomCalendarContext';
import {taskSettingMode} from '../../../../types/commonUnionType';
import {TaskDataContext} from '../../../hooks/useTaskDataContext';
import TaskSetting from '../organisms/taskSetting';
import TaskStateBadge from '../../../parts/taskStateBadge';
import EyeglassIcon from '../../../../assets/svg/eyeglasses_task-by-teacher-icon.svg';
import {calendarTheme} from '../../../../types/customCalendarTypes';
import SaveTaskFooter from '../organisms/saveTaskFooter';
import {ScrollToComponentContextProvider} from '../../../hooks/useScrollToComponentContext';
import TaskMemoTextInput from '../parts/taskMemoTextInput';
import StartCalndarTaskFooter from '../organisms/startCalendarTaskFooter';

export type CalendarTaskSettingViewModalProps = Record<string, never>;

const CalendarTaskSettingViewModal = (
  _props: CalendarTaskSettingViewModalProps,
) => {
  // パラメータをreact-navigationから取得
  const _route = useRoute();
  const {top: _top} = useSafeAreaInsets();
  const {taskSettingList} = useContext(TaskDataContext);
  const {
    calendarTaskSettingMode,
    currentTaskSettingCardId,
    temporaryTaskSetting,
  } = useContext(CalendarTaskSettingViewModalContext);

  const author = useMemo(() => {
    if (calendarTaskSettingMode === taskSettingMode.save) {
      return 'あなた';
    }

    if (!currentTaskSettingCardId || !taskSettingList[currentTaskSettingCardId])
      return null;

    const taskSetting = taskSettingList[currentTaskSettingCardId]?.taskSetting;
    return taskSetting ? taskSetting.author : '';
  }, [calendarTaskSettingMode, currentTaskSettingCardId, taskSettingList]);

  const taskStateBadge = useMemo(() => {
    if (
      !currentTaskSettingCardId ||
      !taskSettingList[currentTaskSettingCardId] ||
      calendarTaskSettingMode === taskSettingMode.save
    )
      return null;
    const taskSetting = taskSettingList[currentTaskSettingCardId]?.taskSetting;
    return taskSetting ? (
      <TaskStateBadge state={taskSetting.taskState} />
    ) : null;
  }, [calendarTaskSettingMode, currentTaskSettingCardId, taskSettingList]);

  const eyeglassIcon = useMemo(() => {
    if (
      !currentTaskSettingCardId ||
      !taskSettingList[currentTaskSettingCardId] ||
      calendarTaskSettingMode === taskSettingMode.save
    )
      return null;
    if (taskSettingList[currentTaskSettingCardId].taskSetting?.isTeacher) {
      return <EyeglassIcon width={24} height={24} />;
    }
  }, [calendarTaskSettingMode, currentTaskSettingCardId, taskSettingList]);

  const scrollViewRef = useRef<ScrollView | null>(null);

  /*
  useEffect(() => {
    console.log(
      'isReloadCurrentSettingId',
      isReloadCurrentSettingId,
      currentTaskSettingCardId,
    );
    if (isReloadCurrentSettingId && currentTaskSettingCardId)
      setCurrentSettingId(currentTaskSettingCardId, {
        questionModeType: temporaryTaskSetting.questionMode,
      });
  }, [isReloadCurrentSettingId, currentTaskSettingCardId]);
  */

  return (
    <>
      <ScrollView ref={scrollViewRef} style={tw`bg-background`}>
        <Spacer isHorizontal={false} size={8} />
        <View style={tw`flex-row w-full justify-between px-4`}>
          <View style={tw`flex-row items-center`}>
            {eyeglassIcon}
            <Spacer isHorizontal size={8} />
            {taskStateBadge}
          </View>
          {/* 作成者 */}
          <View style={tw`pt-1`}>
            <AppText style={tw`text-xs text-primary`}>
              作成者：
              {author}
            </AppText>
          </View>
        </View>
        <Spacer isHorizontal={false} size={8} />

        {/* タイトル */}
        <View style={tw`items-center`}>
          <TextInputContextProvider>
            <TaskTitleTextInput />
          </TextInputContextProvider>
        </View>
        <Spacer isHorizontal={false} size={12} />

        {/* カレンダー */}
        <AccordionMenuContextProvider>
          <CustomCalendarContextProvider
            calendarType={calendarTheme.taskSetting}
          >
            <TaskCalendar />
          </CustomCalendarContextProvider>
        </AccordionMenuContextProvider>
        <Spacer isHorizontal={false} size={12} />

        {/* 課題の設定 */}
        <TaskSetting />
        <Spacer isHorizontal={false} size={12} />

        {/* 通知 */}
        {/* <List
          hasIcon
          hasArrow={false}
          title="通知なし" // stateで管理
          icon={<BellIcon />}
          hasAlert={false}
          onPressOut={() => {
            console.log('通知設定');
          }}
        />
        <Spacer isHorizontal={false} size={12} /> */}

        {/* 色 */}
        <AccordionMenuContextProvider>
          <TaskColor />
        </AccordionMenuContextProvider>
        <Spacer isHorizontal={false} size={12} />

        {/* メモ */}
        <View style={tw`items-center`}>
          <View
            style={tw`w-11/12 h-auto flex-row items-start bg-white rounded-md px-4 py-3`}
          >
            <View style={tw`pt-1`}>
              <PenIcon fill="#727272" width={16} height={16} />
            </View>
            <Spacer isHorizontal size={16} />
            <ScrollToComponentContextProvider scrollViewRef={scrollViewRef}>
              <TextInputContextProvider>
                <TaskMemoTextInput />
              </TextInputContextProvider>
            </ScrollToComponentContextProvider>
          </View>
        </View>
        <Spacer isHorizontal={false} size={300} />
      </ScrollView>

      {calendarTaskSettingMode === taskSettingMode.save ? (
        <SaveTaskFooter />
      ) : calendarTaskSettingMode === taskSettingMode.edit &&
        temporaryTaskSetting.taskSetting?.hasTask ? (
        <StartCalndarTaskFooter />
      ) : null}
    </>
  );
};

export default CalendarTaskSettingViewModal;

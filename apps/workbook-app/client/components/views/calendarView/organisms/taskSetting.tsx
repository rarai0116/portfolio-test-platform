import {useContext} from 'react';
import {View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import List from '../../../parts/list';
import tw from '../../../../tailwind.custom';
import BookShelfIcon from '../../../../assets/svg/book-shelf_schedule-task-icon.svg';
import BuildingIcon from '../../../../assets/svg/building_saved-condition-icon.svg';
import MemoIcon from '../../../../assets/svg/sticky-note_saved-condition-icon.svg';
import {
  type CalendarModalProps,
  allScreenIdList,
} from '../../../../types/viewParameter';
import Spacer from '../../../parts/spacer';
import AppText from '../../../identities/appText';
import {questionState, taskAuthor} from '../../../../types/commonUnionType';

const TaskSetting = () => {
  const navigation =
    useNavigation<CalendarModalProps<'CalendarTaskSetting'>['navigation']>();
  const {taskStrings, temporaryTaskSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  return (
    <View style={tw`w-full items-center`}>
      {temporaryTaskSetting.taskSetting?.hasTask ? (
        <List
          hasArrow
          hasIcon
          height="h-auto"
          title="課題なし"
          icon={<BookShelfIcon />}
          hasAlert={false}
          isDisabled={
            temporaryTaskSetting.taskSetting?.author !== taskAuthor.user ||
            temporaryTaskSetting.taskSetting?.taskState !==
              questionState.notStarted
          }
          onPressOut={() => {
            navigation.navigate('SelectQuestionMode', {
              userId: allScreenIdList.SelectQuestionMode,
            });
          }}
        >
          <View style={tw`flex-row items-center`}>
            <BuildingIcon width={16} height={16} style={tw``} />
            <Spacer isHorizontal size={16} />
            <AppText style={tw`w-11/12 text-sm text-primary`} numberOfLines={1}>
              {taskStrings[0]}
            </AppText>
          </View>
          <Spacer isHorizontal={false} size={4} />
          <View style={tw`flex-row items-center`}>
            <MemoIcon width={16} height={16} style={tw``} />
            <Spacer isHorizontal size={16} />
            <AppText style={tw`w-11/12 text-sm text-primary`} numberOfLines={1}>
              {taskStrings[1]}
            </AppText>
          </View>
        </List>
      ) : (
        <View style={tw`w-full`}>
          <List
            hasArrow
            hasIcon
            title="課題の設定"
            icon={<BookShelfIcon />}
            hasAlert={false}
            onPressOut={() => {
              navigation.navigate('SelectQuestionMode', {
                userId: allScreenIdList.SelectQuestionMode,
              });
            }}
          />
        </View>
      )}
    </View>
  );
};

export default TaskSetting;

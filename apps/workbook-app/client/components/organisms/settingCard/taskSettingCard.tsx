import {View} from 'react-native';
import {Pressable} from 'react-native-gesture-handler';
import {useContext, memo} from 'react';
import AppText from '@identities/appText';
import MemoIcon from '@assets/svg/sticky-note_saved-condition-icon.svg';
import BuildingIcon from '@assets/svg/building_saved-condition-icon.svg';
import ClockIcon from '@assets/svg/clock_saved-condition-icon.svg';
import EyeglassIcon from '@assets/svg/eyeglasses_task-by-teacher-icon.svg';
import TaskStateBadge from '@parts/taskStateBadge';
import Spacer from '@parts/spacer';
import type {SettingCardData} from '@hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import useTaskSettingCard from '@hooks/useTaskSettingCard';
import Skeleton from 'react-native-reanimated-skeleton';
import tw from '@/tailwind.custom';

export type TaskSettingCardProps = {
  // IDの接頭辞task・saved・previous・interruptedによって種類を判別する
  readonly id: string;
  readonly hasInterruptedData?: boolean;
  readonly onPressOut?: (id: string, cardData?: SettingCardData | null) => void;
  readonly isDisablePress?: boolean;
};
const TaskSettingCard = memo(
  (props: TaskSettingCardProps) => {
    const {isDisabledInput} = useContext(GlobalUserSettingContext);

    const {
      cardData,
      taskDate,
      deadlineDate,
      titleColor,
      borderColor,
      categoryString,
      otherSettingString,
      isLoading,
    } = useTaskSettingCard(props.id);

    if (cardData === null) return null;
    return (
      <Skeleton
        containerStyle={tw`w-11/12 items-center `}
        isLoading={isLoading}
      >
        <Pressable
          disabled={isDisabledInput || props.isDisablePress}
          style={({pressed}) =>
            tw`${borderColor} bg-white w-full rounded-md ${
              pressed ? 'bg-gray-200' : ''
            }`
          }
          android_ripple={{color: '#ECECEC'}}
          onPress={() => {
            if (props.onPressOut) props.onPressOut(props.id, cardData);
            //                onPressOutTaskSettingCard();
          }}
        >
          <View style={tw`w-full`}>
            <View>
              {/* ヘッダー */}
              <View style={tw`flex-row items-center justify-between px-4 pt-3`}>
                <AppText style={tw`${titleColor} text-sm`} numberOfLines={1}>
                  {cardData.title}
                </AppText>

                <View style={tw`flex-row items-center`}>
                  {cardData.taskSetting?.isTeacher ? (
                    <EyeglassIcon width={24} height={24} style={tw``} />
                  ) : null}
                  <Spacer isHorizontal size={4} />
                  {cardData.taskSetting?.taskState ? (
                    <TaskStateBadge state={cardData.taskSetting.taskState} />
                  ) : null}
                </View>
              </View>
            </View>

            <View style={tw`w-full px-4 pb-3`}>
              {/* 作成者 */}
              <AppText
                style={tw`w-11/12 text-xs text-secondary`}
                numberOfLines={1}
              >
                作成者：{cardData.taskSetting?.author}
              </AppText>
              <Spacer isHorizontal={false} size={4} />
              {/* 締め切り */}
              <View style={tw`flex-row items-center`}>
                <ClockIcon width={16} height={16} style={tw``} />
                <Spacer isHorizontal size={8} />
                <AppText
                  style={tw`w-11/12 text-sm text-primary`}
                  numberOfLines={1}
                >
                  {taskDate ? `${taskDate}` : `${deadlineDate}まで`}
                </AppText>
              </View>

              <Spacer isHorizontal={false} size={4} />

              {categoryString === '' ? null : (
                <View style={tw`flex-row items-center`}>
                  <BuildingIcon width={16} height={16} style={tw``} />
                  <Spacer isHorizontal size={8} />
                  <AppText
                    style={tw`w-11/12 text-sm text-primary`}
                    numberOfLines={1}
                  >
                    {categoryString}
                  </AppText>
                </View>
              )}

              <Spacer isHorizontal={false} size={4} />

              <View style={tw`flex-row items-center`}>
                <MemoIcon width={16} height={16} style={tw``} />
                <Spacer isHorizontal size={8} />
                <AppText
                  style={tw`w-11/12 text-sm text-primary`}
                  numberOfLines={1}
                >
                  {otherSettingString}
                </AppText>
              </View>
            </View>
          </View>
        </Pressable>
      </Skeleton>
    );
  },
  (prevProps, nextProps) => {
    // カスタム比較関数で必要な場合のみ再レンダリング
    return (
      prevProps.id === nextProps.id &&
      prevProps.isDisablePress === nextProps.isDisablePress
    );
  },
);

export default TaskSettingCard;

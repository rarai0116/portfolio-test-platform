import {View} from 'react-native';
import {useContext} from 'react';
import tw from '../../tailwind.custom';
import BookIcon from '../../assets/svg/book_practice-button.svg';
import BookShelfIcon from '../../assets/svg/book-shelf_task-button.svg';
import PenIcon from '../../assets/svg/pen_common.svg';
import FileIcon from '../../assets/svg/folder_saved-condition-button.svg';
import DeleteIcon from '../../assets/svg/trash-can_delete-task-icon.svg';
import ClockIcon from '../../assets/svg/clock_previous-button.svg';
import CardButton from '../parts/cardButton';
import Spacer from '../parts/spacer';
import {ButtonStates, type ButtonStateType} from '../hooks/useButtonContext';
import {
  questionSettingState,
  type QuestionSettingStateType,
} from '../../types/commonUnionType';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';

export type QuestionCardButtonsProps = {
  readonly onPressOutPractice: () => void;
  readonly onPressOutExam: () => void;
  readonly onPressOutSavedSetting: () => void;
  readonly onPressOutTask?: () => void;
  readonly onPressOutResetQuestionSetting?: () => void;
  readonly onPressOutPreviousSavedSetting?: () => void;
  readonly settingState?: QuestionSettingStateType;
  readonly resetQuestionSettingButtonState?: ButtonStateType;
};

const QuestionCardButtons = (props: QuestionCardButtonsProps) => {
  // const hasNewTask = useContext(TaskModeViewContext);
  const {previousSavedSetting} = useContext(GlobalSaveDataContext);
  return (
    <View style={tw``}>
      <View style={tw`w-10/12 flex-row justify-between`}>
        <CardButton
          width="47%"
          height="88px"
          text="練習"
          onPressOut={props.onPressOutPractice}
        >
          <BookIcon width={30} height={30} />
        </CardButton>
        <CardButton
          width="47%"
          height="88px"
          text="模擬試験"
          onPressOut={props.onPressOutExam}
        >
          <PenIcon fill="#FF5D5E" width={30} height={30} />
        </CardButton>
      </View>
      <Spacer isHorizontal={false} size={16} />
      <View style={tw`w-10/12 flex-row justify-between`}>
        <CardButton
          width="47%"
          height="88px"
          text="保存した設定"
          onPressOut={props.onPressOutSavedSetting}
        >
          <FileIcon fill="#727272" width={30} height={30} />
        </CardButton>
        {props.settingState === questionSettingState.task ? (
          <CardButton
            width="47%"
            height="88px"
            text="課題をリセット"
            buttonState={props.resetQuestionSettingButtonState}
            onPressOut={() => {
              if (props.onPressOutResetQuestionSetting) {
                props.onPressOutResetQuestionSetting();
              }
            }}
          >
            <DeleteIcon width={30} height={30} />
          </CardButton>
        ) : (
          <CardButton
            width="47%"
            height="88px"
            text="課題"
            onPressOut={() => {
              if (props.onPressOutTask) {
                props.onPressOutTask();
              }
            }}
          >
            <BookShelfIcon width={30} height={30} />
            {/* hasNewTask ? (
              <View style={tw`flex-row`}>
                <BookShelfIcon width={30} height={30} />
                <View style={tw``}><AlertIcon /></View>
              </View>
            ) : (
              <BookShelfIcon width={30} height={30} />
            ) */}
          </CardButton>
        )}
      </View>
      <Spacer isHorizontal={false} size={16} />
      {props.settingState === questionSettingState.task ? null : (
        <View style={tw`w-10/12 flex-row justify-start`}>
          <CardButton
            width="47%"
            height="88px"
            text="前回の設定"
            buttonState={
              previousSavedSetting
                ? ButtonStates.released
                : ButtonStates.disabled
            }
            onPressOut={props.onPressOutPreviousSavedSetting}
          >
            <ClockIcon fill="#727272" width={30} height={30} />
          </CardButton>

          {/* <CardButton
          width="47%"
          height="88px"
          text="今日の課題"
          buttonState={
            todayTaskSettinIdList.length > 0
              ? ButtonStates.released
              : ButtonStates.disabled
          }
          onPressOut={props.onPressOutTodayTask}
        >
          <FlagIcon fill="#727272" width={30} height={30} />
        </CardButton> */}
        </View>
      )}
    </View>
  );
};

export default QuestionCardButtons;

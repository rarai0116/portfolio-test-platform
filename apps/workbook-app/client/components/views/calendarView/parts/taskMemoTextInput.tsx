import {useContext, useMemo} from 'react';
import {Platform} from 'react-native';
import AppTextInput from '../../../identities/appTextInput';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {TextInputContext} from '../../../hooks/useTextInputContextProvider';
import {ScrollToComponentContext} from '../../../hooks/useScrollToComponentContext';

const TaskMemoTextInput = () => {
  const {temporaryTaskSetting, handleChangeTaskMemo, saveTaskMemo} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const {scrollToTargetComponent} = useContext(ScrollToComponentContext);
  const {textInputRef} = useContext(TextInputContext);

  const defaultValue = useMemo(() => {
    if (temporaryTaskSetting.taskSetting?.taskMemo === undefined) return '';
    return temporaryTaskSetting.taskSetting.taskMemo;
  }, [temporaryTaskSetting.taskSetting?.taskMemo]);

  return (
    <AppTextInput
      hasMultiline
      id="calendarMemo"
      // textAlignVerticalが効かないためleadingで調整
      inputStyle={`w-11/12 text-base rounded-md ${
        Platform.OS === 'ios' ? 'leading-4' : ''
      }`}
      height={200}
      maxLength={500}
      placeholder="メモ"
      isShowWordCount={false}
      defaultValue={defaultValue}
      onFocus={() => {
        scrollToTargetComponent(textInputRef);
      }}
      onChangeText={handleChangeTaskMemo}
      onBlur={saveTaskMemo}
    />
  );
};

export default TaskMemoTextInput;

import {useContext, useMemo} from 'react';
import {Platform, View} from 'react-native';
import AppTextInput from '../../../identities/appTextInput';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {TextInputContext} from '../../../hooks/useTextInputContextProvider';
import AppText from '../../../identities/appText';
import tw from '../../../../tailwind.custom';
import Spacer from '../../../parts/spacer';
import {taskAuthor} from '../../../../types/commonUnionType';

const TaskTitleTextInput = () => {
  const {textValue, isFocusTextInput} = useContext(TextInputContext);
  const {temporaryTaskSetting, handleChangeTitle, saveTaskTitle} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  const defaultValue = useMemo(() => {
    return temporaryTaskSetting.title;
  }, [temporaryTaskSetting.title]);

  const alertText = useMemo(() => {
    if (!isFocusTextInput && textValue === '') {
      return '入力してください';
    }

    return undefined;
  }, [isFocusTextInput, textValue]);

  return (
    <>
      {alertText && (
        <>
          <View style={tw`w-11/12`}>
            <AppText style={tw`text-errorred-400 text-xs pl-4`}>
              {alertText}
            </AppText>
          </View>
          <Spacer isHorizontal={false} size={2} />
        </>
      )}

      {temporaryTaskSetting.taskSetting?.author === taskAuthor.user ? (
        <AppTextInput
          id="calendarTitle"
          textAlignVertical="center"
          // textAlignVerticalが効かないためleadingで調整
          inputStyle={`w-11/12 bg-white text-lg text-primary pl-4 rounded-md 
            ${Platform.OS === 'ios' ? 'leading-6' : ''}
            `}
          maxLength={40}
          height={52}
          placeholder="タイトル"
          isShowWordCount={false}
          defaultValue={defaultValue}
          onChangeText={handleChangeTitle}
          onBlur={saveTaskTitle}
        />
      ) : (
        <AppText
          style={tw`w-11/12 bg-white text-lg text-primary py-2 pl-4 rounded-md`}
        >
          {temporaryTaskSetting.title}
        </AppText>
      )}
    </>
  );
};

export default TaskTitleTextInput;

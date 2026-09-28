import {View} from 'react-native';
import {Pressable} from 'react-native-gesture-handler';
import {useContext} from 'react';
import tw from '../../../../tailwind.custom';
import AppTextInput from '../../../identities/appTextInput';
import {TextInputContext} from '../../../hooks/useTextInputContextProvider';
import PenIcon from '../../../../assets/svg/pen_common.svg';

type GoalTextInputProps = Record<string, never>;

const GoalTextInput = (_props: GoalTextInputProps) => {
  const {textInputRef} = useContext(TextInputContext);
  const focusTextInput = () => {
    if (textInputRef.current) {
      textInputRef.current.focus();
    }
  };

  return (
    <View style={tw`bg-white`}>
      <AppTextInput
        id="goalInput"
        textAlignVertical="center"
        inputStyle="text-primary text-base text-center w-11/12 bg-white"
        maxLength={40}
        height={40}
        hasMultiline={false}
        isShowWordCount={false}
        placeholder="ここに目標を入力してください"
      />
      <Pressable
        style={tw`absolute right-5 top-2.5`}
        onPressOut={focusTextInput}
      >
        <PenIcon width={24} height={24} fill="#BABABA" />
      </Pressable>
    </View>
  );
};

export default GoalTextInput;

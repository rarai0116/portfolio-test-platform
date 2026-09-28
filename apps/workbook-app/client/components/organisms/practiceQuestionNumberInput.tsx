import {Platform, View} from 'react-native';
import {useContext, useMemo, useEffect} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import AppTextInput from '../identities/appTextInput';

export type PracticeQuestionNumberInputProps = Record<string, never>;

const PracticeQuestionNumberInput = (
  _props: PracticeQuestionNumberInputProps,
) => {
  const {maxNumberOfQuestion, questionNumberOfQuestionsInfo, currentIndex} =
    useContext(QuestionSettingViewContext);
  const {isPreviousFocus, isFocusTextInput, textValue} =
    useContext(TextInputContext);

  const alertText: string = useMemo(() => {
    if (textValue) {
      if (
        // 0以下の場合
        Number(textValue) <= 0
      ) {
        return '1以上の数値を入力してください';
      } else if (/\D+/g.test(textValue)) {
        // 数字と-以外
        return '有効な数値を入力してください';
      } else if (
        // 最大数以上の場合
        Number(textValue) > maxNumberOfQuestion
      ) {
        return '出題可能問題数を超えています';
      } else {
        return ''; // 入力されている状態
      }
    } else if (isFocusTextInput) {
      return ''; // 入力中は空にする
    } else if (isPreviousFocus) {
      return '*';
    }

    return ''; // 初期状態
  }, [textValue, isFocusTextInput, maxNumberOfQuestion, isPreviousFocus]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (currentIndex !== 3) return;

    if (textValue && alertText === '') {
      questionNumberOfQuestionsInfo.setSelectedValue([textValue]);
    } else {
      questionNumberOfQuestionsInfo.setSelectedValue(['']);
    }
  }, [alertText, textValue, currentIndex]);

  return (
    <>
      <View style={tw`flex-row items-center`}>
        <AppTextInput
          id="practiceQuestionNumberInput"
          // textAlignVerticalが効かないためleadingで調整
          inputStyle={`w-30 py-1 px-2 bg-white text-lg text-primary border border-tertiary rounded
                          ${Platform.OS === 'ios' ? 'leading-5' : ''}
                          `}
          height={40}
          isShowWordCount={false}
          maxLength={4}
          keyboardType="number-pad"
          textAlignVertical="center"
          defaultValue={String(maxNumberOfQuestion)}
        />
        <AppText style={tw`ml-2 text-secondary text-sm`}>問</AppText>
      </View>
      <AppText style={tw`text-errorred-400 text-sm`}>{alertText}</AppText>
    </>
  );
};

export default PracticeQuestionNumberInput;

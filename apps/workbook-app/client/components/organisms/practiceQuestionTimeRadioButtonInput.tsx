import {Platform, View} from 'react-native';
import {useContext, useEffect, useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import RadioButton from '../identities/radioButton';
import AppTextInput from '../identities/appTextInput';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import {InitialSettingDataContext} from '../hooks/useInitialSettingDataContext';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';

export type PracticeQuestionTimeRadioButtonInputProps = Record<string, never>;

const PracticeQuestionTimeRadioButtonInput = (
  _props: PracticeQuestionTimeRadioButtonInputProps,
) => {
  const isFocused = useIsFocused();
  const {questionTimeInfo, currentIndex} = useContext(
    QuestionSettingViewContext,
  );
  const {
    isFocusTextInput,
    textValue,
    setTextValue,
    isPreviousFocus,
    textInputRef,
  } = useContext(TextInputContext);
  const {currentPlayData} = useContext(GlobalUserSettingContext);
  const {initialPracticeQuestionSetting} = useContext(
    InitialSettingDataContext,
  );
  const alertText = useMemo(() => {
    // テスト設定モードの時以外は処理しない
    if (currentPlayData) return '';
    // 無制限を選択時は何も表示しない
    if (
      questionTimeInfo.checkedIdList[0] ===
      initialPracticeQuestionSetting.questionTime[0].id
    ) {
      return '';
    }

    if (textValue !== '' && textValue !== undefined) {
      if (
        // 0以下の場合
        Number(textValue) <= 0
      ) {
        return '1以上の数値を入力してください';
      } else if (/\D+/g.test(textValue)) {
        // 数字と-以外
        return '有効な数値を入力してください';
      } else {
        return ''; // 入力されている状態
      }
    } else if (isFocusTextInput) {
      return ''; // 入力中は空にする
    } else if (isPreviousFocus) {
      return '*';
    }

    return ''; // 初期状態
  }, [
    textValue,
    questionTimeInfo,
    currentPlayData,
    initialPracticeQuestionSetting,
    isPreviousFocus,
    isFocusTextInput,
  ]);

  // ラジオボタンや入力ボックスに何かが入力され、アラートに何も表示されない場合のみチェックを通過したとみなしてsetValueに値を入れる
  // 何かしらのエラーが表示されている場合は空文字を入れる
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (currentIndex !== 3) return;
    if (
      questionTimeInfo.checkedIdList[0] ===
      initialPracticeQuestionSetting.questionTime[0].id
    ) {
      questionTimeInfo.setSelectedValue('');
      return;
    }

    if (alertText === '' && textValue) {
      questionTimeInfo.setSelectedValue(textValue);
      return;
    }

    questionTimeInfo.setSelectedValue('');
  }, [alertText, questionTimeInfo.checkedIdList[0], textValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (alertText !== '') return;
    if (!questionTimeInfo.selectedValue) {
      setTextValue('');
      return;
    }

    if (textValue !== questionTimeInfo.selectedValue) {
      setTextValue(questionTimeInfo.selectedValue);
    }
  }, [questionTimeInfo.selectedValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // 問題設定モードの時以外は処理しない
    if (currentPlayData) return;
    // Focusして数値入力している場合、入力のラジオボタンに自動でチェックをいれる
    if (isFocusTextInput) {
      questionTimeInfo.setCheckedList([questionTimeInfo.buttonList[1]]);
    }
  }, [isFocusTextInput]);

  return (
    <View style={tw`w-full items-center`}>
      <View style={tw`flex-row w-11/12 bg-white rounded-md px-4  py-3`}>
        <RadioButton
          info={questionTimeInfo.buttonList[0]}
          radioButtonStyle="flex-1 pt-2"
          onActivateFromProps={() => {
            textInputRef.current?.blur();
          }}
        />
        <View style={tw`flex-1 ml-4`}>
          <RadioButton
            info={questionTimeInfo.buttonList[1]}
            radioButtonStyle="flex-row items-center"
            onActivateFromProps={() => {
              textInputRef.current?.focus();
            }}
          >
            <AppTextInput
              id="practiceQuestionTimeInput"
              // textAlignVerticalが効かないためleadingで調整
              inputStyle={`ml-3 mr-2 w-20 px-2 bg-white text-lg text-primary border border-tertiary rounded
                ${Platform.OS === 'ios' ? 'leading-5' : ''}
                `}
              height={40}
              isShowWordCount={false}
              maxLength={3}
              keyboardType="number-pad"
              textAlignVertical="center"
            />
            <AppText>分</AppText>
          </RadioButton>

          <AppText style={tw`text-errorred-400 text-sm`}>{alertText}</AppText>
        </View>
      </View>
    </View>
  );
};

export default PracticeQuestionTimeRadioButtonInput;

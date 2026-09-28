import {View} from 'react-native';
import {useContext} from 'react';
import {ScrollView} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from '../parts/spacer';
import {CheckButtonContextProvider} from '../hooks/useCheckButtonContext';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import PracticeQuestionNumberInput from './practiceQuestionNumberInput';
import PracticeQuestionTimeRadioButtonInput from './practiceQuestionTimeRadioButtonInput';

export type PracticeQuestionSettingStepFourProps = Record<string, never>;

const PracticeQuestionSettingStepFour = (
  _props: PracticeQuestionSettingStepFourProps,
) => {
  const {questionTimeInfo, maxNumberOfQuestion} = useContext(
    QuestionSettingViewContext,
  );

  /*
  const [enabledPicker, setEnabledPicker] = useState<boolean>(true);

  useEffect(() => {
    if (settingState === questionSettingState.task) {
      setEnabledPicker(false);
    }
  }, [settingState]);
  */

  return (
    <ScrollView>
      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-secondary text-sm pl-8`}>問題数</AppText>
      <Spacer isHorizontal={false} size={4} />
      <View style={tw`items-center`}>
        <View style={tw`w-11/12 bg-white rounded-md pl-8 p-3`}>
          <View style={tw`flex-row items-center `}>
            <AppText style={tw`text-secondary text-sm`}>最大</AppText>
            <AppText style={tw`text-errorred-400 text-xl pb-0.5`}>
              {maxNumberOfQuestion}
            </AppText>
            <AppText style={tw`text-secondary text-sm`}>問 出題可能</AppText>
          </View>
          <Spacer isHorizontal={false} size={12} />

          <TextInputContextProvider>
            <PracticeQuestionNumberInput />
          </TextInputContextProvider>
        </View>
      </View>
      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-secondary text-sm pl-8`}>制限時間</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionTimeInfo.buttonList}
        checkedButtonList={questionTimeInfo.checkedList}
        setCheckedButtonList={questionTimeInfo.setCheckedList}
      >
        <TextInputContextProvider>
          <PracticeQuestionTimeRadioButtonInput />
        </TextInputContextProvider>
      </CheckButtonContextProvider>

      <Spacer isHorizontal={false} size={12} />

      {/*
      <AppText style={tw`text-secondary text-sm pl-8`}>オプション</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionOptionInfo.buttonList}
        checkedButtonList={questionOptionInfo.checkedList}
        setCheckedButtonList={questionOptionInfo.setCheckedList}
      >
        <CheckBoxList row={1} />
      </CheckButtonContextProvider>


      <Spacer isHorizontal={false} size={12} />
      */}
    </ScrollView>
  );
};

export default PracticeQuestionSettingStepFour;

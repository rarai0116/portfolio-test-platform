import {useCallback, useContext} from 'react';
import {ScrollView} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from '../parts/spacer';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {CheckButtonContextProvider} from '../hooks/useCheckButtonContext';
import RadioButtonList from '../parts/radioButtonList';
import CheckBoxList from '../parts/checkBoxList';

export type PracticeQuestionSettingStepOneProps = Record<string, never>;

const PracticeQuestionSettingStepOne = (
  _props: PracticeQuestionSettingStepOneProps,
) => {
  const {
    questionOrderInfo,
    questionFormatInfo,
    questionDifficultiesInfo,
    questionCoverageInfo,
    questionOptionInfo,
    settingState,
    initializeCategoryCheckList,
    isCurrentSelectedQaa,
  } = useContext(QuestionSettingViewContext);

  const activateEffect = useCallback(
    (id?: string) => {
      if (settingState !== '初期設定') return;
      initializeCategoryCheckList(id);
    },
    [initializeCategoryCheckList, settingState],
  );

  return (
    <ScrollView>
      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-primary text-sm pl-8`}>出題形式</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionFormatInfo.buttonList}
        checkedButtonList={questionFormatInfo.checkedList}
        setCheckedButtonList={questionFormatInfo.setCheckedList}
        onActivateEffect={activateEffect}
        onDeactivateEffect={activateEffect}
      >
        <RadioButtonList />
      </CheckButtonContextProvider>
      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-primary text-sm pl-8`}>出題範囲</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionCoverageInfo.buttonList}
        checkedButtonList={questionCoverageInfo.checkedList}
        setCheckedButtonList={questionCoverageInfo.setCheckedList}
        onActivateEffect={activateEffect}
        onDeactivateEffect={activateEffect}
      >
        <RadioButtonList />
      </CheckButtonContextProvider>

      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-primary text-sm pl-8`}>出題順</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionOrderInfo.buttonList}
        checkedButtonList={questionOrderInfo.checkedList}
        setCheckedButtonList={questionOrderInfo.setCheckedList}
        onActivateEffect={activateEffect}
        onDeactivateEffect={activateEffect}
      >
        <RadioButtonList />
      </CheckButtonContextProvider>

      <Spacer isHorizontal={false} size={12} />

      <AppText style={tw`text-primary text-sm pl-8`}>難易度</AppText>
      <Spacer isHorizontal={false} size={4} />
      <CheckButtonContextProvider
        buttonInfoList={questionDifficultiesInfo.buttonList}
        checkedButtonList={questionDifficultiesInfo.checkedList}
        setCheckedButtonList={questionDifficultiesInfo.setCheckedList}
        onActivateEffect={activateEffect}
        onDeactivateEffect={activateEffect}
      >
        <CheckBoxList row={3} />
      </CheckButtonContextProvider>
      <Spacer isHorizontal={false} size={12} />

      {!isCurrentSelectedQaa && (
        <>
          <AppText style={tw`text-primary text-sm pl-8`}>オプション</AppText>
          <Spacer isHorizontal={false} size={4} />
          <CheckButtonContextProvider
            buttonInfoList={questionOptionInfo.buttonList}
            checkedButtonList={questionOptionInfo.checkedList}
            setCheckedButtonList={questionOptionInfo.setCheckedList}
          >
            <CheckBoxList row={1} />
          </CheckButtonContextProvider>
        </>
      )}

      <Spacer isHorizontal={false} size={12} />
    </ScrollView>
  );
};

export default PracticeQuestionSettingStepOne;

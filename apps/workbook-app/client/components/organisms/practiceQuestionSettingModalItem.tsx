import {View, useWindowDimensions} from 'react-native';
import {useContext, useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {CheckButtonContextProvider} from '../hooks/useCheckButtonContext';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import {handleCheckButton} from '../functionals/accordionMenuController';
import PracticeQuestionSettingStepOne from './practiceQuestionSettingStepOne';
import PracticeQuestionSettingStepTwo from './practiceQuestionSettingStepTwo';
import PracticeQuestionSettingStepThree from './practiceQuestionSettingStepThree';
import PracticeQuestionSettingStepFour from './practiceQuestionSettingStepFour';
import PracticeQuestionSettingStepFive from './practiceQuestionSettingStepFive';

export type PracticeQuestionSettingModalItemProps = {
  readonly currentIndex: string;
};

const PracticeQuestionSettingModalItem = (
  properties: PracticeQuestionSettingModalItemProps,
) => {
  const {width} = useWindowDimensions();
  const {
    checkedCategoryButtonInfoList,
    questionCategoryCommonButtonList,
    setCheckedCategoryButtonInfoList,
  } = useContext(QuestionSettingViewContext);

  const step3 = useMemo(() => {
    return (
      <CheckButtonContextProvider
        /* key={stepThreeKey} */
        buttonInfoList={questionCategoryCommonButtonList.buttonList}
        checkedButtonList={checkedCategoryButtonInfoList}
        setCheckedButtonList={setCheckedCategoryButtonInfoList}
        toggleCallback={handleCheckButton}
      >
        <PracticeQuestionSettingStepThree />
      </CheckButtonContextProvider>
    );
  }, [
    questionCategoryCommonButtonList.buttonList,
    checkedCategoryButtonInfoList,
    setCheckedCategoryButtonInfoList,
  ]);

  const step4 = useMemo(() => {
    return <PracticeQuestionSettingStepFour />;
  }, []);

  const step5 = useMemo(() => {
    return (
      <TextInputContextProvider>
        <PracticeQuestionSettingStepFive />
      </TextInputContextProvider>
    );
  }, []);

  const item: React.JSX.Element = useMemo(() => {
    switch (properties.currentIndex) {
      case 'practice-step1': {
        return <PracticeQuestionSettingStepOne />;
      }

      case 'practice-step2': {
        return <PracticeQuestionSettingStepTwo />;
      }

      case 'practice-step3': {
        return step3;
      }

      case 'practice-step4': {
        return step4;
      }

      case 'practice-step5': {
        return step5;
      }

      default: {
        return <AppText>default</AppText>;
      }
    }
  }, [step3, step4, step5, properties.currentIndex]);
  return <View style={tw`w-[${width}px]`}>{item}</View>;
};

export default PracticeQuestionSettingModalItem;

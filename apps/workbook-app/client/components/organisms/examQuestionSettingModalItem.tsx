import {View, useWindowDimensions} from 'react-native';
import {useMemo, useContext} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import ExamQuestionSettingStepOne from './examQuestionSettingStepOne';
import ExamQuestionSettingStepTwo from './examQuestionSettingStepTwo';
import ExamQuestionSettingStepThree from './examQuestionSettingStepThree';

export type ExamQuestionSettingModalItemProps = {readonly id: string};

const ExamQuestionSettingModalItem = (
  properties: ExamQuestionSettingModalItemProps,
) => {
  const {width} = useWindowDimensions();
  const {examSlides: _examSlides} = useContext(QuestionSettingViewContext);

  const item: React.JSX.Element = useMemo(() => {
    switch (properties.id) {
      case 'exam-step1': {
        return <ExamQuestionSettingStepOne />;
      }

      case 'exam-step2': {
        return <ExamQuestionSettingStepTwo />;
      }

      case 'exam-step3': {
        return <ExamQuestionSettingStepThree />;
      }

      default: {
        return <AppText>default</AppText>;
      }
    }
  }, [properties.id]);
  return <View style={tw`w-[${width}px]`}>{item}</View>;
};

export default ExamQuestionSettingModalItem;

import {View} from 'react-native';
import {useContext} from 'react';
import tw from '../../tailwind.custom';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import Spacer from '../parts/spacer';
import List from '../parts/list';

export type ExamQuestionSettingStepThreeProps = Record<string, never>;

const ExamQuestionSettingStepThree = (
  _props: ExamQuestionSettingStepThreeProps,
) => {
  const {
    examSubjectCheckedButtonInfoList,
    examNumberOfQuestionsCheckedButtonList,
  } = useContext(QuestionSettingViewContext);

  return (
    <View style={tw`w-full bg-background`}>
      <Spacer isHorizontal={false} size={12} />

      <List
        headerTitle="出題範囲"
        title={examSubjectCheckedButtonInfoList[0]?.name ?? ''}
      />
      <Spacer isHorizontal={false} size={24} />

      <List
        headerTitle="問題数"
        title={examNumberOfQuestionsCheckedButtonList[0]?.name ?? ''}
      />
    </View>
  );
};

export default ExamQuestionSettingStepThree;

import {View} from 'react-native';
import Spacer from '@parts/spacer';
import List from '@parts/list';
import tw from '@/tailwind.custom';

export type ExamQuestionSettingPreviewBoxProps = {
  readonly questonCoverage: string;
  readonly questionNumberOfQuestions: string;
};

const ExamQuestionSettingPreviewBox = (
  props: ExamQuestionSettingPreviewBoxProps,
) => {
  const {questonCoverage, questionNumberOfQuestions} = props;
  return (
    <View style={tw`flex-1 w-full bg-background`}>
      <Spacer isHorizontal={false} size={12} />

      <List headerTitle="出題範囲" title={questonCoverage} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="問題数" title={questionNumberOfQuestions} />
    </View>
  );
};

export default ExamQuestionSettingPreviewBox;

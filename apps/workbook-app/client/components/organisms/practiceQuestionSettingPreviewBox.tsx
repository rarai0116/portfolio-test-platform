import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import List from '@parts/list';
import Spacer from '@parts/spacer';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type PracticeQuestionSettingPreviewBoxProps = {
  readonly questionFormat: string;
  readonly questionCoverage: string;
  readonly questionOrder: string;
  readonly questionDifficulties: string;
  readonly questionTime: string;
  readonly questionOption: string;
  readonly questionNumberOfQuestions: string;
  readonly questionCategory: string;
};

const PracticeQuestionSettingPreviewBox = (
  props: PracticeQuestionSettingPreviewBoxProps,
) => {
  const {
    questionOrder,
    questionCoverage,
    questionDifficulties,
    questionTime,
    questionOption,
    questionFormat,
    questionNumberOfQuestions,
    questionCategory,
  } = props;

  return (
    <ScrollView style={tw`w-full bg-background`}>
      <Spacer isHorizontal={false} size={12} />
      <List headerTitle="出題形式" title={questionFormat} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="出題範囲" title={questionCoverage} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="出題順" title={questionOrder} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="難易度" title={questionDifficulties} />
      <Spacer isHorizontal={false} size={24} />

      <AppText style={tw` text-primary text-sm pl-8`}>カテゴリ</AppText>
      <Spacer isHorizontal={false} size={4} />
      <View style={tw`items-center`}>
        <View style={tw`w-11/12 bg-white rounded-md px-4 py-3`}>
          <AppText style={tw` text-primary text-base`}>
            {questionCategory}
          </AppText>
        </View>
      </View>

      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="問題数" title={questionNumberOfQuestions} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="制限時間" title={questionTime} />
      <Spacer isHorizontal={false} size={24} />

      <List headerTitle="オプション" title={questionOption} />
      <Spacer isHorizontal={false} size={100} />
    </ScrollView>
  );
};

export default PracticeQuestionSettingPreviewBox;

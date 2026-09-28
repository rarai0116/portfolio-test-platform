import {View} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type QuestionCardProps = {
  readonly questionNumber: string;
  readonly questionSentence: string;
};

const QuestionCard = (props: QuestionCardProps) => {
  return (
    <View style={tw`items-center`}>
      <View style={tw`w-11/12 rounded bg-white p-4`}>
        <AppText style={tw`text-primary text-sm`}>
          No.{props.questionNumber}
        </AppText>
        <AppText style={tw`w-full text-primary text-sm`}>
          {props.questionSentence}
        </AppText>
      </View>
    </View>
  );
};

export default QuestionCard;

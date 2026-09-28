import {View} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type AnswerPartProps = {
  readonly answerType: string;
  readonly answerData: string;
};

const AnswerPart = (props: AnswerPartProps) => {
  return (
    <View
      style={tw`flex-row border-b border-solid border-primary items-center`}
    >
      <AppText style={tw`pt-0.5 pr-1 text-xs text-primary`}>
        {props.answerType}
      </AppText>
      <AppText style={tw`pr-0.5 text-lg text-primary`}>
        {props.answerData}
      </AppText>
    </View>
  );
};

export default AnswerPart;

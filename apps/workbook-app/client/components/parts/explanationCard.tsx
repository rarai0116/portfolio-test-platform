import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type ExplanationCardProps = {
  readonly questionNumber: string;
  readonly explanationSentence: string[];
};

const ExplanationCard = (props: ExplanationCardProps) => {
  const explanarionSentence = useMemo(() => {
    return props.explanationSentence.map((_v, i) => {
      const _key = `choiceSentence_${i}`;
      const keyView = `choiceSentenceKeyViewA_${i}`;
      return (
        <View key={keyView}>
          <View style={tw`flex-row`}>
            <AppText style={tw`text-primary text-sm`}>{`${i + 1}．`}</AppText>
            <AppText style={tw`w-11/12 text-primary text-sm`}>
              {props.explanationSentence[i]}
            </AppText>
          </View>
          {i === props.explanationSentence.length - 1 ? null : (
            <Spacer isHorizontal={false} size={16} />
          )}
        </View>
      );
    });
  }, [props.explanationSentence]);
  return (
    <View style={tw`items-center`}>
      <View style={tw`w-11/12 rounded bg-white px-5 py-4`}>
        <AppText style={tw`text-primary text-sm`}>
          No.{props.questionNumber}
        </AppText>
        {explanarionSentence}
      </View>
    </View>
  );
};

export default ExplanationCard;

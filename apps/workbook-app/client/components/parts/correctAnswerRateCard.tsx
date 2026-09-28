import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type CorrectAnswerRateCardProps = {
  readonly totalNumberOfQuestionsinTest: number;
  readonly numberOfCorrectAnswers: number;
};

const CorrectAnswerRateCard = (props: CorrectAnswerRateCardProps) => {
  const correctAnswerRate = useMemo(() => {
    return (
      Math.floor(
        (props.numberOfCorrectAnswers / props.totalNumberOfQuestionsinTest) *
          100,
      ) ?? 0
    );
  }, [props.numberOfCorrectAnswers, props.totalNumberOfQuestionsinTest]);

  return (
    <View style={tw`items-center`}>
      <View style={tw`w-10/12 rounded bg-white items-center`}>
        <Spacer isHorizontal={false} size={32} />
        <View style={tw``}>
          <View style={tw`flex-row items-end`}>
            <AppText style={tw`text-workbookblue-500 text-xxxxxl`}>
              {props.numberOfCorrectAnswers}
            </AppText>
            <AppText style={tw`text-primary text-xxl`}>
              /{props.totalNumberOfQuestionsinTest}問
            </AppText>
          </View>

          <AppText style={tw`text-primary text-xxl`}>
            正答率&nbsp;{correctAnswerRate}%
          </AppText>
        </View>
        <Spacer isHorizontal={false} size={32} />
      </View>
    </View>
  );
};

export default CorrectAnswerRateCard;

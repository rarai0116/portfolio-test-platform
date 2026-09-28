import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type ChoicesCardProps = {readonly choicesSentence: string[]};

const ChoicesCard = (props: ChoicesCardProps) => {
  const choicesSentence = useMemo(() => {
    return props.choicesSentence.map((_v, i) => {
      const keyView = `choiceSentenceKeyViewA_${i}`;
      return (
        <View key={keyView}>
          <View style={tw`flex-row`}>
            <AppText style={tw`text-primary text-sm`}>{`${i + 1}．`}</AppText>
            <AppText style={tw`w-11/12 text-primary text-sm`}>
              {props.choicesSentence[i]}
            </AppText>
          </View>
          {i === props.choicesSentence.length - 1 ? null : (
            <Spacer isHorizontal={false} size={16} />
          )}
        </View>
      );
    });
  }, [props.choicesSentence]);

  return (
    <View style={tw`items-center`}>
      <View style={tw`w-11/12 rounded bg-white px-4 py-4`}>
        {choicesSentence}
      </View>
    </View>
  );
};

export default ChoicesCard;

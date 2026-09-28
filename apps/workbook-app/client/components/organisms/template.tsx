import {Text, View} from 'react-native';
import tw from '../../tailwind.custom';

type Props = {
  readonly text: string;
};

const Template = (props: Props) => {
  return (
    <View style={tw`flex flex-col flex-nowrap container`}>
      <Text>{props.text}</Text>
    </View>
  );
};

export default Template;

import {View} from 'react-native';
// import HeaderBackButton from '../parts/testheaderBackButton';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

type Props = {
  readonly title?: string;
  // backOnPress: () => void;
};

const MainHeader = (props: Props) => {
  return (
    <View style={tw`bg-workbookblue-500 h-20 justify-center`}>
      {/* <HeaderBackButton onPress={props.backOnPress} /> */}
      <AppText style={tw`text-white text-center`}>{props.title}</AppText>
    </View>
  );
};

export default MainHeader;

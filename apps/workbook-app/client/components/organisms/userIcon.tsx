import {View} from 'react-native';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type UserIconProps = {readonly user: string; readonly color: string};

const UserIcon = (props: UserIconProps) => {
  return (
    <View
      style={tw`w-6 h-6 rounded-full bg-${props.color} items-center justify-center pt-0.5`}
    >
      <AppText style={tw`text-white text-sm`}>{props.user.slice(0, 1)}</AppText>
    </View>
  );
};

export default UserIcon;

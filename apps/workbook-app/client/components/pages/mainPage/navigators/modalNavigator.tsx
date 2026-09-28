import {createStackNavigator} from '@react-navigation/stack';
import type {StackNavigationOptions} from '@react-navigation/stack';
import CalendarSettingModalContainer from '@views/calendarSettingModalContainer';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {View, Dimensions} from 'react-native';
import tw from '@/tailwind.custom';
import ModalManagerContextProvider from '@/components/hooks/useModalManagerContext';

const ModalNavigatior = () => {
  const {bottom} = useSafeAreaInsets();
  const _screenHeight = Dimensions.get('window').height;
  const _Stack = createStackNavigator();
  const _screenOptions: StackNavigationOptions = {
    presentation: 'transparentModal',
    headerShown: false,
    headerShadowVisible: false,
    cardOverlayEnabled: true,
    gestureEnabled: false,
    cardStyle: {
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    freezeOnBlur: true,
  };

  return (
    <ModalManagerContextProvider>
      <CalendarSettingModalContainer />
      {/** 下部インセットの分の隙間を埋める */}
      <View style={tw`bottom-0 w-full h-[${bottom}px] bg-white`} />
    </ModalManagerContextProvider>
  );
};

export default ModalNavigatior;

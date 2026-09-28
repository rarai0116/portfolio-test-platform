import {SafeAreaView} from 'react-native-safe-area-context';
import {useContext, useEffect} from 'react';
import {useNavigation} from '@react-navigation/native';
import AppText from '../identities/appText';
import tw from '../../tailwind.custom';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import type {RootPagesProps} from '../../types/viewParameter';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

const Maintenance = () => {
  const {isMaintenance} = useContext(GlobalUserSettingContext);
  const rootNavigation =
    useNavigation<RootPagesProps<'Maintenance'>['navigation']>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // メンテナンスモードが終了したらローディングページへ遷移
    if (!isMaintenance) {
      rootNavigation.navigate('LoadingPage', {
        userId: 'page-loading',
      });
    }
  }, [isMaintenance]);

  return (
    <GestureHandlerRootView style={tw`flex-1`}>
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={tw`flex-1 justify-center items-center`}
      >
        <AppText>メンテナンス中です</AppText>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default Maintenance;

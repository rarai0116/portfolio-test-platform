import {View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {MyPageViewsProps} from '../../../types/viewParameter';
import tw from '../../../tailwind.custom';
import AppText from '../../identities/appText';

export type MyPageSettingViewProps = Record<string, never>;

const MyPageSettingView = (_props: MyPageSettingViewProps) => {
  const _navigation =
    useNavigation<MyPageViewsProps<'MyPageSetting'>['navigation']>();
  return (
    <View>
      <AppText style={tw`text-workbookblue-300`}>設定</AppText>
    </View>
  );
};

export default MyPageSettingView;

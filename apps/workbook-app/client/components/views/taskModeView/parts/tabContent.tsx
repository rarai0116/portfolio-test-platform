import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import Background from '@parts/background';
import Spacer from '@parts/spacer';
import AppText from '@identities/appText';
import SecondaryTabs from '@parts/secondaryTabs';
import tw from '@/tailwind.custom';

export type TabContentProps = {
  readonly children?: React.ReactNode;
};

const TabContent = (props: TabContentProps) => {
  return (
    <View>
      <SecondaryTabs />
      <ScrollView
        nestedScrollEnabled
        contentContainerStyle={tw`grow`}
        style={tw`w-full `}
      >
        <Background>
          {props.children}
          {!props.children && (
            <View style={tw`flex-1 items-center pt-20`}>
              <AppText style={tw`text-lg text-secondary`}>
                課題はありません
              </AppText>
            </View>
          )}
        </Background>
        <Spacer isHorizontal={false} size={300} />
      </ScrollView>
    </View>
  );
};

export default TabContent;

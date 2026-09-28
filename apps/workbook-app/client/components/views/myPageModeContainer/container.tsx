import {createStackNavigator} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import type {
  MyPageViewsList,
  TabViewsProps,
} from '../../../types/viewParameter';
import tw from '../../../tailwind.custom';
import SlideAnimation from '../../functionals/windowAnimation';
import {LeftArrowHeaderButton} from '../../organisms/headerButtons';
import AppText from '../../identities/appText';
import MyPageHomeView from './myPageHomeView';
import MyPageMessageView from './myPageMessageView';
import MyPageInquiryFormView from './myPageInquiryFormView';
import MyPageSettingView from './myPageSettingView';
import MyPageChangeGradeView from './myPageChangeGradeView';
import MyPageEachMessageView from './myPageEachMessageView';

const MyPageModeContainerBody = () => {
  const MyPageModeStack = createStackNavigator<MyPageViewsList>();
  const _navigation = useNavigation<TabViewsProps<'MyPageTab'>['navigation']>();
  const screenOptions: StackNavigationOptions = {
    headerShown: true,
    cardStyleInterpolator: SlideAnimation,
    headerStyle: {
      backgroundColor: '#289DF4',
      height: 56,
    },
    headerStatusBarHeight: 0,
    headerTintColor: '#fff',
    headerTitleAllowFontScaling: true,
    headerTitleStyle: {
      fontSize: 16,
    },
    headerTitleAlign: 'center',
    headerLeftContainerStyle: {paddingLeft: 16},
    headerRightContainerStyle: {paddingRight: 16},
    headerLeft: () => null,
    headerBackImage: () => <LeftArrowHeaderButton />,
  };

  return (
    <MyPageModeStack.Navigator screenOptions={screenOptions}>
      <MyPageModeStack.Screen
        name="MyPageHome"
        component={MyPageHomeView}
        options={{
          headerTitle() {
            return (
              <AppText style={tw`text-white text-base`}>マイページ</AppText>
            );
          },
          headerBackImage: () => null,
        }}
      />
      <MyPageModeStack.Screen
        name="MyPageMessage"
        component={MyPageMessageView}
        options={{
          headerTitle() {
            return (
              <AppText style={tw`text-white text-base`}>マイページ</AppText>
            );
          },
        }}
      />
      <MyPageModeStack.Screen
        name="MyPageEachMessage"
        component={MyPageEachMessageView}
        options={{
          headerTitle() {
            return (
              <AppText style={tw`text-white text-base`}>メッセージ</AppText>
            );
          },
        }}
      />
      <MyPageModeStack.Screen
        name="MyPageInquiryForm"
        component={MyPageInquiryFormView}
        options={{
          headerTitle() {
            return (
              <AppText style={tw`text-white text-base`}>お問い合わせ</AppText>
            );
          },
        }}
      />
      <MyPageModeStack.Screen
        name="MyPageSetting"
        component={MyPageSettingView}
        options={{
          headerTitle() {
            return <AppText style={tw`text-white text-base`}>設定</AppText>;
          },
        }}
      />
      <MyPageModeStack.Screen
        name="MyPageChangeGrade"
        component={MyPageChangeGradeView}
        options={{
          headerTitle() {
            return <AppText style={tw`text-white text-base`}>設定</AppText>;
          },
        }}
      />
    </MyPageModeStack.Navigator>
  );
};

export default MyPageModeContainerBody;

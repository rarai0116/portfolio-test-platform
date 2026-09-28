import {
  CardStyleInterpolators,
  createStackNavigator,
} from '@react-navigation/stack';
import type {StackNavigationOptions} from '@react-navigation/stack';
import {useMemo, useCallback} from 'react';
import {Platform, View} from 'react-native';
import type {HomeViewsList} from '../../types/viewParameter';
import tw from '../../tailwind.custom';
import SlideAnimation from '../functionals/windowAnimation';
import ModalManagerContextProvider from '../hooks/useModalManagerContext';
import AppText from '../identities/appText';
import LeftArrow from '../../assets/svg/left-arrow.svg';
import {LeftArrowHeaderButton} from '../organisms/headerButtons';
import QuestionHomeView from './questionHomeView';
import TaskModeView from './taskModeView';
import SavedSettingView from './savedSettingView';

const QuestionModeContainer = () => {
  const QuestionModeStack = createStackNavigator<HomeViewsList>();

  const screenOptions: StackNavigationOptions = useMemo(() => {
    return {
      animation: 'fade_from_bottom',
      cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
      headerStyle: {
        backgroundColor: '#289DF4',
        height: 56,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontSize: 16,
      },
      headerTitleAlign: 'center',
      headerStatusBarHeight: 0,
      headerLeftContainerStyle: {paddingLeft: 16},
      headerRightContainerStyle: {paddingRight: 16},
      freezeOnBlur: true,
      headerBackImage: () => (
        <LeftArrow width={24} height={24} fill="#ffffff" />
      ),
    };
  }, []);
  const _QuestionScreenOptions: StackNavigationOptions = useMemo(() => {
    return {
      animation: 'none',
      cardStyleInterpolator:
        Platform.OS === 'android' ? undefined : SlideAnimation,
      // animation: 'slide_from_right',
      headerShown: true,
      gestureEnabled: false,
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
      headerBackImage: () => <LeftArrowHeaderButton />,
      headerBackButtonDisplayMode: 'minimal',
    };
  }, []);
  const homeHeaderTitle = useCallback(() => {
    return <AppText style={tw`text-white text-base`}>ホーム</AppText>;
  }, []);
  const taskModeHeaderTitle = useCallback(() => {
    return <AppText style={tw`text-white text-base`}>課題</AppText>;
  }, []);
  const _questionCategoryAccordionHeaderTitle = useCallback(() => {
    return (
      <AppText style={tw`text-white text-base`}>
        出題カテゴリ―(未回答/苦手問題/合計)
      </AppText>
    );
  }, []);
  const savedSettingHeaderTitle = useCallback(() => {
    return <AppText style={tw`text-white text-base`}>保存した設定</AppText>;
  }, []);
  const nullComp = useCallback(() => {
    return null;
  }, []);
  return (
    <ModalManagerContextProvider>
      <View style={tw`flex-1 bg-background`}>
        <QuestionModeStack.Navigator screenOptions={screenOptions}>
          <QuestionModeStack.Screen
            name="Home"
            component={QuestionHomeView}
            options={{
              headerTitle: homeHeaderTitle,
              headerBackImage: nullComp,
              headerLeft: nullComp,
            }}
          />
          <QuestionModeStack.Screen
            name="TaskMode"
            component={TaskModeView}
            options={{
              headerTitle: taskModeHeaderTitle,
              headerBackTitle: 'ホーム',
            }}
          />
          <QuestionModeStack.Screen
            name="SavedSetting"
            component={SavedSettingView}
            options={{
              headerTitle: savedSettingHeaderTitle,
              headerBackTitle: 'ホーム',
            }}
          />
        </QuestionModeStack.Navigator>
      </View>
    </ModalManagerContextProvider>
  );
};

export default QuestionModeContainer;

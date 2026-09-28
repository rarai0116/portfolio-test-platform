import {useContext, useEffect, useMemo} from 'react';
import {Platform, View} from 'react-native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import {TransitionPresets, createStackNavigator} from '@react-navigation/stack';
import {useNavigation, useNavigationState} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import QuestionSettingViewContextProvider from '@hooks/useQuestionSettingViewContext';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import {QuestionAndChoicesViewContextProvider} from '@hooks/useQuestionsAndChoicesViewContext';
import ModalLikeViewManagerContextProvider from '@hooks/useModalLikeViewManagerContext';
import {CalendarTaskSettingViewModalContextProvider} from '@views/calendarView/hooks/useCalendarTaskSettingViewModalContext';
import {TaskDataContextProvider} from '@hooks/useTaskDataContext';
import {CalendarViewContextProvider} from '@views/calendarView/hooks/useCalendarViewContext';
import DisabledBlocker from '@parts/disabledBlocker';
import MainPageContextProvider from '@hooks/mainPageContext';
import TabNavigator from './navigators/tabNavigator';
import ModalNavigatior from './navigators/modalNavigator';
import TestNavigator from './navigators/testNavigator';
import tw from '@/tailwind.custom';
import type {MainViewsList, RootPagesProps} from '@/types/viewParameter';

const MainPage = () => {
  const {top} = useSafeAreaInsets();
  const Stack = createStackNavigator<MainViewsList>();
  const rootNavigation =
    useNavigation<RootPagesProps<'MainPage'>['navigation']>();

  // 現在のナビゲーション状態を取得
  const _isModalStackActive = useNavigationState((state) => {
    // ルートの配列から現在アクティブなスクリーンを検索
    // console.log('state', state);
    const mainPageState = state.routes.find(
      (route) => route.name === 'MainPage',
    );
    if (!mainPageState) return false;
    const index = mainPageState.state?.index;
    if (index === undefined) return false;
    const routes = mainPageState.state?.routes;
    if (!routes) return false;
    // console.log('routes', routes[index]);
    return routes[index]?.name === 'ModalStack';
  });
  const {
    isMaintenance,
    /* isModalVisibleRef,
    isModalLikeViewVisibleRef, */
  } = useContext(GlobalUserSettingContext);

  const rootScreenOptions: StackNavigationOptions = useMemo(() => {
    return {
      animation: 'fade_from_bottom',
      headerShown: false,
      headerBackButtonDisplayMode: 'minimal',
      headerBackImage: () => null,
      unmountOnBlur: true,
      freezeOnBlur: true,
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // メンテナンスモードになった場合、強制的にメンテナンス画面に遷移
    if (isMaintenance) {
      rootNavigation.navigate('Maintenance', {userId: 'page-maintenance'});
    }
  }, [isMaintenance]);

  /* const statusBarBackGroundColor = useMemo(() => {
    return getStatusBarBackgroundColor(
      isModalVisibleRef.current || isModalLikeViewVisibleRef.current,
    );
  }, [isModalVisibleRef, isModalLikeViewVisibleRef]); */

  const modalAnimation = useMemo(() => {
    if (Platform.OS === 'ios') {
      return TransitionPresets.ModalSlideFromBottomIOS;
    }

    return undefined;
  }, []);

  return (
    <MainPageContextProvider navigation={rootNavigation}>
      <ModalLikeViewManagerContextProvider>
        <TaskDataContextProvider>
          <QuestionSettingViewContextProvider>
            <CalendarViewContextProvider>
              <CalendarTaskSettingViewModalContextProvider>
                <QuestionAndChoicesViewContextProvider>
                  {/*  <View
                    style={tw`flex-1 ${isModalStackActive ? 'bg-[#289DF4]' : 'bg-white'} pb-[${0}px] pl-[${left}px] pr-[${right}px]`}
                  > */}
                  <View style={tw`flex-1 pt-[${top}px] bg-workbookblue-500 `}>
                    {/* <StatusBar
                      barStyle="default"
                      backgroundColor={statusBarBackGroundColor}
                    /> */}

                    <DisabledBlocker key="disabled-blocker" />
                    <Stack.Navigator screenOptions={rootScreenOptions}>
                      <Stack.Screen name="Tab" component={TabNavigator} />
                      <Stack.Screen name="Test" component={TestNavigator} />
                      <Stack.Group
                        screenOptions={{
                          presentation: 'transparentModal',
                          animation: 'fade',
                          headerShown: false,
                          headerTransparent: true,
                          freezeOnBlur: true,
                          ...modalAnimation, // ここでは下から上へ
                        }}
                      >
                        <Stack.Screen
                          name="ModalStack"
                          component={ModalNavigatior}
                        />
                      </Stack.Group>
                    </Stack.Navigator>
                  </View>
                </QuestionAndChoicesViewContextProvider>
              </CalendarTaskSettingViewModalContextProvider>
            </CalendarViewContextProvider>
          </QuestionSettingViewContextProvider>
        </TaskDataContextProvider>
      </ModalLikeViewManagerContextProvider>
    </MainPageContextProvider>
  );
};

export default MainPage;

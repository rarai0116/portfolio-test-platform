import {useCallback, useMemo} from 'react';
import {View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AppText from '@identities/appText';
import MyPageModeContainer from '@views/myPageModeContainer';
import CalendarModeContainer from '@views/calendarModeContainer';
import DataAnalysisModeContainer from '@views/dataAnalysisModeContainer';
import QuestionModeContainer from '@views/questionModeContainer';
import type {TabViewsList} from '@/types/viewParameter';
import HumanIcon from '@/assets/svg/human_tab-bar-icon.svg';
import CalenderIcon from '@/assets/svg/calendar_tab-bar-icon.svg';
import GraphIcon from '@/assets/svg/graph_tab-bar-icon.svg';
import PenIcon from '@/assets/svg/pen_common.svg';
import tw from '@/tailwind.custom';

const tabBarStyle = tw`flex-1 items-center mt-0 h-[50px] w-auto`;

const TabNavigator = () => {
  const {top: _top, bottom: _bottom} = useSafeAreaInsets();
  const Tab = createBottomTabNavigator<TabViewsList>();
  const screenOptions: BottomTabNavigationOptions = useMemo(() => {
    return {
      animation: 'none',
      headerShown: false,
      tabBarActiveTintColor: '#289DF4',
      tabBarInactiveTintColor: '#727272',
      tabBarIconStyle: {marginTop: 2, width: 60},
      tabBarLabelStyle: {marginBottom: 2},
      tabBarStyle: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 90,
        backgroundColor: '#fff',
        borderTopWidth: 0,
        paddingTop: 8,
      },
      lazy: true,
      headerLeft: () => null,
    };
  }, []);
  const questionModeTabBarIcon = useCallback(
    ({color}: {readonly color: string}) => {
      return (
        <View style={tabBarStyle}>
          <PenIcon fill={color} width={24} height={24} pointerEvents="none" />
          <AppText style={tw`text-xxs text-[${color}]`}>問題</AppText>
        </View>
      );
    },
    [],
  );

  const dataAnalysisModeTabBarIcon = useCallback(
    ({color}: {readonly color: string}) => {
      return (
        <View style={tabBarStyle}>
          <GraphIcon fill={color} width={24} height={24} pointerEvents="none" />
          <AppText style={tw`text-xxs text-[${color}]`}>分析</AppText>
        </View>
      );
    },
    [],
  );
  const calendarModeTabBarIcon = useCallback(
    ({color}: {readonly color: string}) => {
      return (
        <View style={tabBarStyle}>
          <CalenderIcon
            fill={color}
            width={24}
            height={24}
            pointerEvents="none"
          />
          <AppText style={tw`text-xxs text-[${color}]`}>カレンダー</AppText>
        </View>
      );
    },
    [],
  );
  const myPageModeTabBarIcon = useCallback(
    ({color}: {readonly color: string}) => {
      return (
        <View style={tabBarStyle}>
          <HumanIcon fill={color} width={24} height={24} pointerEvents="none" />
          <AppText style={tw`text-xxs text-[${color}]`}>マイページ</AppText>
        </View>
      );
    },
    [],
  );

  return (
    /*  <View style={tw`flex-1 bg-white pb-[${bottom}px] pl-[${0}px] pr-[${0}px]`}> */
    <View style={tw`flex-1`}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen
          name="QuestionTab"
          component={QuestionModeContainer}
          options={{
            tabBarLabel: '',
            tabBarIcon: questionModeTabBarIcon,
          }}
        />

        <Tab.Screen
          name="DataAnalysisTab"
          component={DataAnalysisModeContainer}
          options={{
            tabBarLabel: '',
            tabBarIcon: dataAnalysisModeTabBarIcon,
          }}
        />
        <Tab.Screen
          name="CalenderTab"
          component={CalendarModeContainer}
          options={{
            tabBarLabel: '',
            tabBarIcon: calendarModeTabBarIcon,
          }}
        />
        <Tab.Screen
          name="MyPageTab"
          component={MyPageModeContainer}
          options={{
            tabBarLabel: '',
            tabBarIcon: myPageModeTabBarIcon,
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

export default TabNavigator;

import {
  createStackNavigator,
  type StackNavigationOptions,
} from '@react-navigation/stack';
import {useContext, useMemo} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {View} from 'react-native';
import LeftArrow from '../../../../assets/svg/left-arrow.svg';
import type {TestViewsList} from '@/types/viewParameter';
import QuestionAndChoicesView from '@/components/views/questionAndChoicesView';
import QuestionResultView from '@/components/views/questionResultView';
import QuestionResultAnswerView from '@/components/views/questionResultAnswerView';
import tw from '@/tailwind.custom';
import AppText from '@/components/identities/appText';
import {QuestionAndChoicesViewContext} from '@/components/hooks/useQuestionsAndChoicesViewContext';
import {ErrorReporfFormContextProvider} from '@/components/viewmodals/errorReportFormVIewModal/hooks/useErrorReporfFormContext';

const TestNavigator = () => {
  const {bottom} = useSafeAreaInsets();
  const Stack = createStackNavigator<TestViewsList>();
  const screenOptions: StackNavigationOptions = {
    // cardStyleInterpolator: SlideAnimation,
    animation: 'slide_from_right',
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
    /* headerBackImage: () => <LeftArrowHeaderButton />, */
    headerBackButtonDisplayMode: 'minimal',
    freezeOnBlur: true,
  };
  const {isAnswerShowed} = useContext(QuestionAndChoicesViewContext);
  const questionModeHeaderText = useMemo(() => {
    if (isAnswerShowed) {
      return <AppText style={tw`text-white text-base`}>解説</AppText>;
    }

    return <AppText style={tw`text-white text-base`}>問題</AppText>;
  }, [isAnswerShowed]);
  return (
    <ErrorReporfFormContextProvider>
      <View
        style={tw`flex-1 bg-white pb-[${bottom}px] pl-[${0}px] pr-[${0}px]`}
      >
        {/*      <View style={tw`flex-1 bg-[#289DF4] pt-[${top}px]`}> */}
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen
            name="QuestionAndChoicesView"
            component={QuestionAndChoicesView}
            options={{
              headerTitle() {
                return questionModeHeaderText;
              },
            }}
          />
          <Stack.Screen
            name="QuestionResultView"
            component={QuestionResultView}
            options={{
              headerTitle() {
                return <AppText style={tw`text-white text-base`}>結果</AppText>;
              },
            }}
          />
          <Stack.Screen
            name="QuestionResultAnswerView"
            component={QuestionResultAnswerView}
            options={{
              headerTitle() {
                return <AppText style={tw`text-white text-base`}>解説</AppText>;
              },
              headerBackImage: () => (
                <LeftArrow width={24} height={24} fill="#ffffff" />
              ),
            }}
          />
        </Stack.Navigator>
        {/*      </View> */}
      </View>
    </ErrorReporfFormContextProvider>
  );
};

export default TestNavigator;

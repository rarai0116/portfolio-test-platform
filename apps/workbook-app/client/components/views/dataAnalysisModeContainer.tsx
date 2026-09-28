import {createStackNavigator} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import type {
  DataAnalysisViewsList,
  DataAnalysisViewsProps,
} from '../../types/viewParameter';
import tw from '../../tailwind.custom';
import SlideAnimation from '../functionals/windowAnimation';
import ModalManagerContextProvider from '../hooks/useModalManagerContext';
import AppText from '../identities/appText';
import DataAnalysisHomeView from './dataAnalysisHomeView';

export type DataAnalysisModeContainerProps = Record<string, never>;

const DataAnalysisModeContainer = (_props: DataAnalysisModeContainerProps) => {
  const DataAnalysisModeStack = createStackNavigator<DataAnalysisViewsList>();
  const _navigation =
    useNavigation<DataAnalysisViewsProps<'DataAnalysisHome'>['navigation']>();
  const screenOptions: StackNavigationOptions = {
    cardStyleInterpolator: SlideAnimation,
    headerStyle: {
      backgroundColor: '#289DF4',
      height: 56,
    },
    headerTintColor: '#fff',
    headerTitleAllowFontScaling: true,
    headerTitleStyle: {
      fontSize: 16,
    },
    headerStatusBarHeight: 0,
    headerTitleAlign: 'center',
    headerLeftContainerStyle: {paddingLeft: 16},
    headerRightContainerStyle: {paddingRight: 16},
    headerLeft: () => null,
    headerBackImage: () => null,
  };

  return (
    <ModalManagerContextProvider>
      <DataAnalysisModeStack.Navigator screenOptions={screenOptions}>
        <DataAnalysisModeStack.Screen
          name="DataAnalysisHome"
          component={DataAnalysisHomeView}
          options={{
            headerTitle() {
              return (
                <AppText style={tw`text-white text-base`}>データ分析</AppText>
              );
            },
          }}
        />
      </DataAnalysisModeStack.Navigator>
    </ModalManagerContextProvider>
  );
};

export default DataAnalysisModeContainer;

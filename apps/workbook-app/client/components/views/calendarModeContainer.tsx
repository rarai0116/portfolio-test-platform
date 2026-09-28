import {useNavigation} from '@react-navigation/native';
import type {StackNavigationOptions} from '@react-navigation/stack';
import {createStackNavigator} from '@react-navigation/stack';
import type {
  CalendarViewsList,
  CalendarViewsProps,
} from '../../types/viewParameter';
import ModalManagerContextProvider from '../hooks/useModalManagerContext';
import tw from '../../tailwind.custom';
import CalendarView from './calendarView';

export type CalendarModeContainerProps = Record<string, never>;

const CalendarModeContainer = (_props: CalendarModeContainerProps) => {
  const CalendarModeStack = createStackNavigator<CalendarViewsList>();
  const _navigation =
    useNavigation<CalendarViewsProps<'CalendarHome'>['navigation']>();
  const screenOptions: StackNavigationOptions = {
    animation: 'none',
    headerShown: false,
    headerBackButtonDisplayMode: 'minimal',
    headerBackImage: () => null,
    cardStyle: {backgroundColor: tw.color('bg-white')},
  };

  return (
    <ModalManagerContextProvider>
      <CalendarModeStack.Navigator screenOptions={screenOptions}>
        <CalendarModeStack.Screen
          name="CalendarHome"
          component={CalendarView}
          options={{
            headerShown: false,
          }}
        />
      </CalendarModeStack.Navigator>
    </ModalManagerContextProvider>
  );
};

export default CalendarModeContainer;

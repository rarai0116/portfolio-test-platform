import {View} from 'react-native';
import type {ScrollView} from 'react-native-gesture-handler';
import Spacer from '@parts/spacer';
import CalendarTaskList from './calendarTaskList';
import tw from '@/tailwind.custom';

const DisplayCalendarTaskList = (props: {
  list: string[];
  scrollRef: React.RefObject<ScrollView | null>;
}) => {
  return props.list.map((id, i) => {
    return (
      <View key={id} style={tw`w-full items-center`}>
        <CalendarTaskList key={id} id={id} />
        {!(i === props.list.length - 1) && (
          <Spacer isHorizontal={false} size={12} />
        )}
      </View>
    );
  });
};

export default DisplayCalendarTaskList;

import {View} from 'react-native';
import tw from '../../../../tailwind.custom';
import type {CalenderYmData} from '../../../../types/customCalendarTypes';
import CalendarWeekLabel from './calendarWeekLabel';
import CalendarMonth from './calendarMonth';

type CalendarItemProps = {
  readonly yearMonth: CalenderYmData;
  readonly width: number;
};

/* const MemorizedCalendarMonth = memo(CalendarMonth, (prevProps, nextProps) => {
  // 比較のロジックを追加
  return (
    prevProps.yearMonth.year === nextProps.yearMonth.year &&
    prevProps.yearMonth.month === nextProps.yearMonth.month
  );
});
*/
export const CalendarItem = (props: CalendarItemProps) => {
  return (
    <>
      <CalendarWeekLabel />
      <View style={tw`flex-row flex-wrap`}>
        <CalendarMonth yearMonth={props.yearMonth} width={props.width} />
      </View>
    </>
  );
};

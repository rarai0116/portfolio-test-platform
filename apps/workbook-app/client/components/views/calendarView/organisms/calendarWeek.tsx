import {View} from 'react-native';
import {useContext, useMemo, memo} from 'react';
import tw from '../../../../tailwind.custom';
import CalendarDateCell from '../parts/calendarDateCell';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import TaskCalendarDateCell from '../parts/taskCalendarDateCell';
import {
  calendarTheme,
  type CalenderYmData,
} from '../../../../types/customCalendarTypes';

type CalendarWeekProps = {
  readonly weekStartDate: Date; // 日曜
  readonly yearMonth: CalenderYmData;
};

// components/views/calendarView/organisms/calendarWeek.tsx
const CalendarWeek = memo(
  (props: CalendarWeekProps) => {
    // const {getMappingKey} = useMappingHelper();
    const {calendarType} = useContext(CustomCalendarContext);

    // 現在の重い処理を最適化
    const weekDates = useMemo(() => {
      // 7つの日付を一度に計算
      const dates: Array<{
        dateObj: Date;
        key: string | number | bigint;
        isCurrentMonth: boolean;
        currentDate: number;
      }> = [];

      const baseDate = new Date(props.weekStartDate);

      for (let d = 0; d < 7; d++) {
        const dateObj = new Date(baseDate);
        dateObj.setDate(baseDate.getDate() + d);
        const key = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}-${d}`;

        dates.push({
          dateObj,
          key,
          isCurrentMonth: props.yearMonth.month === dateObj.getMonth() + 1,
          currentDate: dateObj.getDate(),
        });
      }

      return dates;
    }, [props.weekStartDate, props.yearMonth.month]);

    // レンダリング処理を分離
    const renderDateCells = useMemo(() => {
      if (calendarType === calendarTheme.basic) {
        return weekDates.map((dateInfo) => (
          <CalendarDateCell
            key={dateInfo.key}
            isCurrentMonth={dateInfo.isCurrentMonth}
            dateObj={dateInfo.dateObj}
          >
            {dateInfo.currentDate}
          </CalendarDateCell>
        ));
      } else {
        return weekDates.map((dateInfo) => (
          <TaskCalendarDateCell
            key={dateInfo.key}
            isCurrentMonth={dateInfo.isCurrentMonth}
            dateObj={dateInfo.dateObj}
          >
            {dateInfo.currentDate}
          </TaskCalendarDateCell>
        ));
      }
    }, [weekDates, calendarType]);

    return (
      <View style={styles.weekContainer} pointerEvents="none">
        {renderDateCells}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // より効率的な比較
    return (
      prevProps.weekStartDate.getTime() === nextProps.weekStartDate.getTime() &&
      prevProps.yearMonth.year === nextProps.yearMonth.year &&
      prevProps.yearMonth.month === nextProps.yearMonth.month
    );
  },
);

// スタイルを外部で定義
const styles = {
  weekContainer: tw`flex-row w-full`,
};

export default CalendarWeek;

import {
  getCalendarMonthWeekStarts,
  getCalendarDateAtPosition,
} from '../../../functionals/calendarDates';
import {useMemo, memo, useCallback, useContext} from 'react';
import {View, Pressable, type GestureResponderEvent} from 'react-native';
import dayjs from 'dayjs';
import {useMappingHelper} from '@shopify/flash-list';
import tw from '../../../../tailwind.custom';
import type {CalenderYmData} from '../../../../types/customCalendarTypes';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import CalendarWeek from './calendarWeek';
import {calendarTheme} from '@/types/customCalendarTypes';

/** pressedStyle: "tw``"の書き方 */
export type CalendarMonthViewProps = {
  readonly yearMonth: CalenderYmData;
  readonly width: number; // オプションで幅を指定できるようにする
};

// 日付計算のヘルパー関数
const calculateDateFromPosition = (
  yearMonth: CalenderYmData,
  rowIndex: number,
  colIndex: number,
): Date | null => {
  return getCalendarDateAtPosition(
    yearMonth.year,
    yearMonth.month,
    rowIndex,
    colIndex,
  );
};

/** 日付セル */
const CalendarMonth = memo((props: CalendarMonthViewProps) => {
  const {getMappingKey: _getMappingKey} = useMappingHelper();
  const {calendarType, handlePressHomeCalendar, handlePressConsecutiveDates} =
    useContext(CustomCalendarContext);

  const {firstDateOfEachWeek} = useMemo(() => {
    const weekRows = 6;
    const currentYear = Number(props.yearMonth.year);
    const currentMonth = Number(props.yearMonth.month);
    const firstDateOfEachWeek = getCalendarMonthWeekStarts(
      currentYear,
      currentMonth,
    );

    return {
      weekRows,
      firstDateOfEachWeek,
    };
  }, [props.yearMonth]);

  const calendarDateWeeks = useMemo(() => {
    return firstDateOfEachWeek.map((weekStartDate) => (
      <CalendarWeek
        key={`calendar-week-${dayjs(weekStartDate).format('YYYY-MM-DD')}`}
        yearMonth={props.yearMonth}
        weekStartDate={weekStartDate}
      />
    ));
  }, [firstDateOfEachWeek, props.yearMonth]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      const {locationX, locationY} = event.nativeEvent;

      // セルの幅と高さを計算
      const cellWidth = props.width / 7;
      const cellHeight = 40; // h-10 = 40px

      // タッチ位置からセルのインデックスを計算
      const colIndex = Math.floor(locationX / cellWidth);
      const rowIndex = Math.floor(locationY / cellHeight);

      // 日付を計算
      const targetDate = calculateDateFromPosition(
        props.yearMonth,
        rowIndex,
        colIndex,
      );

      if (targetDate) {
        // カレンダータイプに応じて処理を分岐
        if (calendarType === calendarTheme.basic) {
          handlePressHomeCalendar(targetDate);
        } else {
          handlePressConsecutiveDates(targetDate);
        }
      }
    },
    [
      props.yearMonth,
      handlePressHomeCalendar,
      handlePressConsecutiveDates,
      props.width,
      calendarType,
    ],
  );

  return (
    <Pressable
      style={tw`bg-white w-full`}
      onPress={(event) => {
        handlePress(event);
      }}
    >
      <View style={tw`bg-white`}>{calendarDateWeeks}</View>
    </Pressable>
  );
});

export default CalendarMonth;

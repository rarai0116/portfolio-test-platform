import {View} from 'react-native';
import {useMemo, type ReactNode, useContext, memo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {dateFormat, getDateToYmdString} from '../../../functionals/timeManager';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import {calendarTheme} from '../../../../types/customCalendarTypes';

export type CalendarDateCellViewProps = {
  readonly children: ReactNode;
  readonly dateObj: Date;
  readonly isCurrentMonth: boolean;
};

/** 日付セル */
const CalendarDateCell = memo((props: CalendarDateCellViewProps) => {
  const {
    getBasicCalendarCellStyle,
    getTodayViewStyle,
    getBasicCalendarTextStyle,
    displayTaskColorMarks,
    displayRestTaskMark,
    selectedDateYmd,
  } = useContext(CustomCalendarContext);
  //  const [isPressed, setIsPressed] = useState(false);

  const ymd: string = useMemo(() => {
    return getDateToYmdString(props.dateObj, dateFormat.hyphen);
  }, [props.dateObj]);

  const isSelectedDate = useMemo(() => {
    /*    const startYmd = selectedDateObj[0].start
      ? getDateToYmdString(selectedDateObj[0].start, dateFormat.hyphen)
      : undefined;
*/
    return ymd === selectedDateYmd[0].start;
  }, [selectedDateYmd, ymd]);

  const isPressed = useMemo(() => {
    if (isSelectedDate) {
      return true;
    }

    return false;
  }, [isSelectedDate]);

  /*
  useEffect(() => {
    if (isSelectedDate) {
      setIsPressed(true);
    }
  }, [isSelectedDate, setIsPressed]);

  // 選択が外れた場合
  useEffect(() => {
    if (!isPressed) return;
    if (isPressed && !isSelectedDate) {
      setIsPressed(false);
      // console.log(`${ymd}が外れました`);
    }
  }, [isPressed, isSelectedDate, ymd, setIsPressed]);
  */

  const todayStyle = useMemo(() => {
    return getTodayViewStyle(props.dateObj, calendarTheme.basic, isPressed);
  }, [props.dateObj, isPressed, getTodayViewStyle]);

  const restTaskMarks = useMemo(() => {
    return displayRestTaskMark(props.dateObj, calendarTheme.basic);
  }, [props.dateObj, displayRestTaskMark]);

  const taskColorMarks = useMemo(() => {
    return displayTaskColorMarks(props.dateObj, calendarTheme.basic);
  }, [props.dateObj, displayTaskColorMarks]);

  const basicCalendarCellStyle = useMemo(() => {
    return getBasicCalendarCellStyle(isPressed).cellView;
  }, [getBasicCalendarCellStyle, isPressed]);

  const basicCalendarTextStyle = useMemo(() => {
    return getBasicCalendarTextStyle(
      props.dateObj,
      props.isCurrentMonth,
      isPressed,
    );
  }, [
    getBasicCalendarTextStyle,
    props.dateObj,
    props.isCurrentMonth,
    isPressed,
  ]);
  /*    <Pressable
      style={tw`w-1/7 h-10 flex items-center justify-center border-b border-b-quaternary`}
      onPress={() => {
        console.log('press calendar date cell', ymd);
        handlePressHomeCalendar(props.dateObj);
      }}
    >
*/

  return (
    <View
      style={tw`w-1/7 h-10 flex items-center justify-center border-b border-b-quaternary`}
      pointerEvents="none"
    >
      <View style={tw`${basicCalendarCellStyle ?? ''}`}>
        <View style={tw`flex-row w-full justify-center`}>
          <View style={tw`${todayStyle}`}>
            <AppText style={tw`${basicCalendarTextStyle}`}>
              {props.children}
            </AppText>
          </View>
          <View style={tw`absolute right-0.5 top-0`}>{restTaskMarks}</View>
        </View>
        {taskColorMarks}
      </View>
    </View>
  );
});

export default CalendarDateCell;

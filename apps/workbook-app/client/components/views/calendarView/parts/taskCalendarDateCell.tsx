import {View} from 'react-native';
import {useMemo, type ReactNode, useContext, useCallback, memo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {dateFormat, getDateToYmdString} from '../../../functionals/timeManager';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import {calendarTheme} from '../../../../types/customCalendarTypes';

export type TaskCalendarDateCellViewProps = {
  readonly children: ReactNode;
  readonly dateObj: Date;
  readonly isCurrentMonth: boolean;
};

/** 日付セル */
const TaskCalendarDateCell = memo((props: TaskCalendarDateCellViewProps) => {
  const {
    taskCellStyle,
    getTaskCalendarCellStyle,
    getTodayViewStyle,
    getTaskCalendarTextStyle,
    handlePressConsecutiveDates,
    selectedDateYmd,
  } = useContext(CustomCalendarContext);

  //  const [isPressed, setIsPressed] = useState(false);

  const ymd: string = useMemo(() => {
    return getDateToYmdString(props.dateObj, dateFormat.hyphen);
  }, [props.dateObj]);

  const isSelectedDate = useMemo(() => {
    return ymd === selectedDateYmd[0].start || ymd === selectedDateYmd[0].end;
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
    }
  }, [isPressed, isSelectedDate, ymd, setIsPressed]);
  */
  const taskCalendarCellStyle = useMemo(() => {
    return (
      getTaskCalendarCellStyle(props.dateObj, isPressed).touchableHighlight ??
      taskCellStyle.basic.touchableHighlight!
    );
  }, [
    props.dateObj,
    isPressed,
    getTaskCalendarCellStyle,
    taskCellStyle.basic.touchableHighlight,
  ]);
  const taskCalendarCellStyle2 = useMemo(() => {
    return (
      getTaskCalendarCellStyle(props.dateObj, isPressed).cellView ??
      taskCellStyle.basic.cellView!
    );
  }, [
    props.dateObj,
    isPressed,
    getTaskCalendarCellStyle,
    taskCellStyle.basic.cellView,
  ]);

  const todayViewStyle = useMemo(() => {
    return getTodayViewStyle(
      props.dateObj,
      calendarTheme.taskSetting,
      isPressed,
    );
  }, [props.dateObj, isPressed, getTodayViewStyle]);

  const taskCalendarTextStyle = useMemo(() => {
    return getTaskCalendarTextStyle(
      props.dateObj,
      props.isCurrentMonth,
      isPressed,
    );
  }, [
    getTaskCalendarTextStyle,
    props.dateObj,
    props.isCurrentMonth,
    isPressed,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const _onPress = useCallback(() => {
    handlePressConsecutiveDates(props.dateObj);
  }, [props.dateObj]);

  return (
    <View style={tw`${taskCalendarCellStyle}`}>
      <View style={tw`${taskCalendarCellStyle2}`}>
        <View style={tw`${todayViewStyle}`}>
          <AppText style={tw`${taskCalendarTextStyle}`}>
            {props.children}
          </AppText>
        </View>
      </View>
    </View>
  );
});

export default TaskCalendarDateCell;

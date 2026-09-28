import {useCallback, useContext, useMemo} from 'react';
import {Platform, useWindowDimensions, View} from 'react-native';
import {Timestamp} from '@react-native-firebase/firestore';
import {
  dateFormat,
  getDateToYmdString,
  getTodayTimestamp,
  getYmdString,
} from '../../../../functionals/timeManager';
import {
  type CalendarTextStyle,
  calendarTheme,
  type CellState,
  type CalendarThemeType,
  type CellStyle,
  type CalendarDatePeriod,
} from '../../../../../types/customCalendarTypes';
import {CalendarViewContext} from '../useCalendarViewContext';
import {TaskDataContext} from '../../../../hooks/useTaskDataContext';
import tw from '../../../../../tailwind.custom';

export const basicCellStyle: CellState = {
  basic: {
    cellView: 'w-full h-full items-center justify-start',
  },
  pressed: {
    cellView: 'bg-workbookblue-50 w-full h-full items-center justify-start',
  },
};

export const basicTextStyle: CalendarTextStyle = {
  text: {
    weekday: 'text-primary text-sm',
    saturday: 'text-workbookblue-500 text-sm',
    sunday: 'text-errorred-400 text-sm',
  },
  pressedText: {
    weekday: 'text-primary text-sm',
    saturday: 'text-workbookblue-500 text-sm',
    sunday: 'text-errorred-400 text-sm',
  },
  otherMonthText: {
    weekday: 'text-tertiary text-sm',
    saturday: 'text-workbookblue-100 text-sm',
    sunday: 'text-errorred-100 text-sm',
  },
  todayText: 'text-white text-xs',
};

export const taskTextStyle: CalendarTextStyle = {
  text: {
    weekday: 'text-primary',
    saturday: 'text-workbookblue-500',
    sunday: 'text-errorred-400',
  },
  pressedText: {
    weekday: 'text-white',
    saturday: 'text-white',
    sunday: 'text-white',
  },
  otherMonthText: {
    weekday: 'text-tertiary',
    saturday: 'text-workbookblue-100',
    sunday: 'text-errorred-100',
  },
  todayText: 'text-white',
};

const basicTodayViewStyle =
  'bg-workbookblue-500 mt-[2.4px] w-4.5 h-4.5 rounded-full items-center justify-center';
const basicTodayViewPressedStyle =
  'bg-workbookblue-500 mt-[2.4px] w-4.5 h-4.5 rounded-full items-center justify-center';
const taskTodayViewStyle =
  'bg-workbookblue-200 w-6 h-6 rounded-full items-center justify-center';
const taskTodayViewPressedStyle = '';

export type CalendarCellStyle = {
  taskCellStyle: CellState;
  taskCalendarWidth: number;
  getBasicCalendarCellStyle: (isPressed: boolean) => CellStyle;
  getTaskCalendarCellStyle: (dateObject: Date, isPressed: boolean) => CellStyle;
  getBasicCalendarTextStyle: (
    dateObject: Date,
    isCurrentMonth: boolean,
    isPressed: boolean,
  ) => string;
  getTaskCalendarTextStyle: (
    dateObject: Date,
    isCurrentMonth: boolean,
    isPressed: boolean,
  ) => string;
  getTodayViewStyle: (
    dateObject: Date,
    calendarType: CalendarThemeType,
    isPressed: boolean,
  ) => string;
  displayTaskColorMarks: (
    dateObject: Date,
    calendarType: CalendarThemeType,
  ) => React.JSX.Element | Array<React.JSX.Element | undefined>;
  displayRestTaskMark: (
    dateObject: Date,
    calendarType: CalendarThemeType,
  ) => React.JSX.Element | Array<React.JSX.Element | undefined>;
};

type Properties = {
  selectedDateObj: CalendarDatePeriod[];
  ymdBetween: string[] | undefined;
};

export const useCalendarCellStyle: (
  properties: Properties,
) => CalendarCellStyle = (properties) => {
  const {selectedDateObj, ymdBetween} = properties;
  const {taskColorDisplayIdList} = useContext(CalendarViewContext);
  const {taskSettingList} = useContext(TaskDataContext);

  // IOSはw-1/7にするとセルの間に隙間ができるため、セルの幅を切り上げで求めてからカレンダーの幅を決める
  const width = useWindowDimensions().width;
  const _taskCalendarWidth = width * (10 / 12); // 11/12にするとはみ出る

  // iOSのセルの幅
  const iosCellWidth = useMemo(
    () => Math.ceil(_taskCalendarWidth / 7),
    [_taskCalendarWidth],
  );

  // タスクカレンダーの幅
  const taskCalendarWidth = useMemo(
    () =>
      //    Console.log('iosCellWidth', iosCellWidth);
      Platform.OS === 'ios' ? iosCellWidth * 7 : _taskCalendarWidth,
    [iosCellWidth, _taskCalendarWidth],
  );

  const taskCellStyle: CellState = useMemo(() => {
    const cellWidth =
      Platform.OS === 'ios' ? iosCellWidth : _taskCalendarWidth / 7;

    // 端の幅はセルの10/12
    const iosEndWidth = Math.ceil(iosCellWidth * (10 / 12));
    const endWidth =
      Platform.OS === 'ios' ? iosEndWidth : cellWidth * (10 / 12);

    return {
      basic: {
        touchableHighlight: `w-[${cellWidth}px] h-10 items-center justify-center border-b border-b-quaternary`,
        cellView: 'w-full h-full items-center justify-center',
      },
      pressed: {
        cellView:
          'bg-workbookblue-500 w-6 h-6 rounded-full items-center justify-center',
      },
      pressedStart: {
        // Pr-4で文字の位置、 ml-5で右側の余白を埋める
        cellView: `bg-workbookblue-500 w-[${endWidth}px] h-6 pr-4 ml-5 rounded-l-full items-center justify-center`,
      },
      pressedEnd: {
        cellView: `bg-workbookblue-500 w-[${endWidth}px] h-6 pl-4 mr-5 rounded-r-full items-center justify-center`,
      },
      pressedBetween: {
        cellView: 'bg-workbookblue-500 w-full h-6 items-center justify-center',
      },
    };
  }, [iosCellWidth, _taskCalendarWidth]);

  /** 今日 20XX-XX-XX */
  const todayYmd = useMemo(() => {
    const now = getTodayTimestamp();
    return getYmdString(now, dateFormat.hyphen);
  }, []);

  /** 基本カレンダーの日付セルスタイル */
  const getBasicCalendarCellStyle = useCallback((isPressed: boolean) => {
    const style = basicCellStyle;
    if (!style.pressed) {
      return style.basic;
    }

    if (isPressed) {
      return style.pressed;
    }

    return style.basic;
  }, []);

  /** 課題カレンダーの日付セルスタイル */
  const getTaskCalendarCellStyle: (
    dateObject: Date,
    isPressed: boolean,
  ) => CellStyle = useCallback(
    (dateObject: Date, isPressed: boolean) => {
      const style = taskCellStyle;
      const startYmd = selectedDateObj[0].start
        ? getDateToYmdString(selectedDateObj[0].start, dateFormat.hyphen)
        : undefined;
      const endYmd = selectedDateObj[0].end
        ? getDateToYmdString(selectedDateObj[0].end, dateFormat.hyphen)
        : undefined;
      const ymd = getDateToYmdString(dateObject, dateFormat.hyphen);
      if (
        !style.pressed ||
        !style.pressedStart ||
        !style.pressedEnd ||
        !style.pressedBetween
      ) {
        return style.basic;
      }

      if (isPressed) {
        if (startYmd === endYmd) {
          return style.pressed;
        }

        if (startYmd === ymd && endYmd) {
          return style.pressedStart;
        }

        if (startYmd === ymd) {
          return style.pressed;
        }

        if (ymd === endYmd) {
          return style.pressedEnd;
        }
      }

      if (ymdBetween?.includes(ymd)) {
        return style.pressedBetween;
      }

      return style.basic;
    },
    [ymdBetween, selectedDateObj, taskCellStyle],
  );

  /** 基本カレンダーの日付テキストスタイル */
  const getBasicCalendarTextStyle = useCallback(
    (dateObject: Date, isCurrentMonth: boolean, isPressed: boolean) => {
      const ymd = getDateToYmdString(dateObject, dateFormat.hyphen);
      const style = basicTextStyle;
      const day = dateObject.getDay();
      if (todayYmd === ymd) {
        return style.todayText;
      }

      switch (day) {
        case 0: {
          if (isCurrentMonth && !isPressed) {
            return style.text.sunday;
          }

          if (isPressed) {
            return style.pressedText.sunday;
          }

          return style.otherMonthText.sunday;
        }

        case 6: {
          if (isCurrentMonth && !isPressed) {
            return style.text.saturday;
          }

          if (isPressed) {
            return style.pressedText.saturday;
          }

          return style.otherMonthText.saturday;
        }

        default: {
          if (isCurrentMonth && !isPressed) {
            return style.text.weekday;
          }

          if (isPressed) {
            return style.pressedText.weekday;
          }

          return style.otherMonthText.weekday;
        }
      }
    },
    [todayYmd],
  );

  /** 課題カレンダーの日付テキストスタイル */
  const getTaskCalendarTextStyle = useCallback(
    (dateObject: Date, isCurrentMonth: boolean, isPressed: boolean) => {
      const style = taskTextStyle;
      const day = dateObject.getDay();
      const ymd = getDateToYmdString(dateObject, dateFormat.hyphen);
      if (todayYmd === ymd) {
        return taskTextStyle.todayText;
      }

      switch (day) {
        case 0: {
          if (ymdBetween?.includes(ymd)) {
            return style.pressedText.weekday;
          }

          if (isCurrentMonth && !isPressed) {
            return style.text.sunday;
          }

          if (isPressed) {
            return style.pressedText.sunday;
          }

          return style.otherMonthText.sunday;
        }

        case 6: {
          if (ymdBetween?.includes(ymd)) {
            return style.pressedText.weekday;
          }

          if (isCurrentMonth && !isPressed) {
            return style.text.saturday;
          }

          if (isPressed) {
            return style.pressedText.saturday;
          }

          return style.otherMonthText.saturday;
        }

        default: {
          if (ymdBetween?.includes(ymd)) {
            return style.pressedText.weekday;
          }

          if (isCurrentMonth && !isPressed) {
            return style.text.weekday;
          }

          if (isPressed) {
            return style.pressedText.weekday;
          }

          return style.otherMonthText.weekday;
        }
      }
    },
    [todayYmd, ymdBetween],
  );

  /** 今日のスタイル */
  const getTodayViewStyle = useCallback(
    (dateObject: Date, calendarType: CalendarThemeType, isPressed: boolean) => {
      const ymd = getDateToYmdString(dateObject, dateFormat.hyphen);
      const pressedViewStyle =
        calendarType === calendarTheme.taskSetting
          ? taskTodayViewPressedStyle
          : basicTodayViewPressedStyle;
      const viewStyle =
        calendarType === calendarTheme.taskSetting
          ? taskTodayViewStyle
          : basicTodayViewStyle;
      if (todayYmd === ymd) {
        return isPressed ? pressedViewStyle : viewStyle;
      }

      return '';
    },
    [todayYmd],
  );

  const displayTaskColorMarks = useCallback(
    (dateObject: Date, calendarType: CalendarThemeType) => {
      if (calendarType === calendarTheme.taskSetting) {
        return <View />;
      }

      // Const timeStamp = String(Timestamp.fromDate(dateObj).seconds);
      // dateObjからyyyymmdd形式の文字列を取得
      const dateString = getDateToYmdString(dateObject, dateFormat.none);
      if (!taskColorDisplayIdList[dateString]) {
        return <View />;
      }

      return taskColorDisplayIdList[dateString].map((id, i) => {
        const key = `${dateString}_${i}`;
        if (i > 2) {
          return undefined;
        }

        if (!id || !taskSettingList[id]?.taskSetting) {
          return <View key={key} style={tw`h-1 w-full mb-0.5`} />;
        }

        const taskSetting = taskSettingList[id]?.taskSetting;
        if (!taskSetting) {
          return <View key={key} style={tw`h-1 w-full mb-0.5`} />;
        }

        const color = taskSetting.taskCalendarColor;
        return <View key={id} style={tw`h-1 w-full mb-0.5 ${color}`} />;
      });
    },
    [taskColorDisplayIdList, taskSettingList],
  );

  const displayRestTaskMark = useCallback(
    (dateObject: Date, calendarType: CalendarThemeType) => {
      if (calendarType === calendarTheme.taskSetting) {
        return <View />;
      }

      const timeStamp = String(Timestamp.fromDate(dateObject).seconds);
      if (!taskColorDisplayIdList[timeStamp]) {
        return <View />;
      }

      return taskColorDisplayIdList[timeStamp].map((_id, i) => {
        const key = `${timeStamp}_${i}`;
        if (i === 3) {
          return (
            <View
              key={key}
              style={tw`border-[3px] border-solid 
                border-t-tertiary border-r-tertiary 
                border-b-transparent border-l-transparent`}
            />
          );
        }

        return <View key={key} />;
      });
    },
    [taskColorDisplayIdList],
  );

  return {
    taskCalendarWidth,
    taskCellStyle,
    getBasicCalendarCellStyle,
    getTaskCalendarCellStyle,
    getBasicCalendarTextStyle,
    getTaskCalendarTextStyle,
    getTodayViewStyle,
    displayTaskColorMarks,
    displayRestTaskMark,
  };
};

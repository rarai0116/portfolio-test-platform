import {
  createContext,
  useMemo,
  useState,
  useContext,
  type ReactNode,
} from 'react';
import {Timestamp} from '@react-native-firebase/firestore';
import {
  dateFormat,
  getDatesBetween,
  getJapanDayBoundary,
  getDateToYmdString,
} from '../../../../functionals/timeManager';
import {CalendarViewContext} from '../useCalendarViewContext';
import {
  calendarTheme,
  type CalendarThemeType,
  type CalendarDatePeriod,
} from '../../../../../types/customCalendarTypes';
import {CalendarTaskSettingViewModalContext} from '../useCalendarTaskSettingViewModalContext';
import {taskSettingMode} from '../../../../../types/commonUnionType';
import {useCalendarSwipe} from './useCalendarSwipe';
import type {CalendarSwipe} from './useCalendarSwipe'; // useCalendarSwipe.tsxで型宣言をexportしておく
import {
  type HandleCalendarCell,
  useHandleCalendarCell,
} from './useHandleCalendarCell';
import {
  type CalendarCellStyle,
  useCalendarCellStyle,
} from './useCalendarCellStyle';

type CustomCalendarContextObject = {
  selectedDateObj: CalendarDatePeriod[];
  setSelectedDateObj: React.Dispatch<
    React.SetStateAction<CalendarDatePeriod[]>
  >;
  selectedDateYmd: Array<{
    start: string;
    end: string;
  }>;
  calendarType: CalendarThemeType;
  ymdBetween: string[] | undefined;
} & CalendarSwipe &
  CalendarCellStyle &
  HandleCalendarCell;

type Props = {
  readonly children: ReactNode;
  readonly calendarType: CalendarThemeType;
};

export const CustomCalendarContext = createContext<CustomCalendarContextObject>(
  {} as CustomCalendarContextObject,
);

export const CustomCalendarContextProvider = (props: Props) => {
  const {homeCalendarSelectedDateObj} = useContext(CalendarViewContext);
  const {temporaryTaskSetting, calendarTaskSettingMode} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const calendarType: CalendarThemeType = useMemo(() => {
    return props.calendarType;
  }, [props.calendarType]);

  /** 初期値Dateオブジェクト */
  const initialSelectedDateObj = useMemo(() => {
    if (
      props.calendarType === calendarTheme.taskSetting &&
      temporaryTaskSetting.taskSetting?.taskDate &&
      calendarTaskSettingMode === taskSettingMode.edit
    ) {
      return {
        start: temporaryTaskSetting.taskSetting.taskDate[0].startAt.toDate(),
        end: temporaryTaskSetting.taskSetting.taskDate[0].endAt.toDate(),
      };
    }

    return {
      start: homeCalendarSelectedDateObj,
      end: undefined,
    };
  }, [
    props.calendarType,
    temporaryTaskSetting,
    homeCalendarSelectedDateObj,
    calendarTaskSettingMode,
  ]);

  /** 選択したDateオブジェクト */
  const [selectedDateObj, setSelectedDateObj] = useState<CalendarDatePeriod[]>([
    initialSelectedDateObj,
  ]);

  /** 開始～終了の間の日付 */
  const ymdBetween: string[] | undefined = useMemo(() => {
    if (!selectedDateObj[0].start || !selectedDateObj[0].end) return;
    const dates = getDatesBetween(
      Timestamp.fromDate(
        getJapanDayBoundary(selectedDateObj[0].start, 'start'),
      ),
      Timestamp.fromDate(getJapanDayBoundary(selectedDateObj[0].end, 'end')),
    );
    const start = getDateToYmdString(
      selectedDateObj[0].start,
      dateFormat.hyphen,
    );
    const end = getDateToYmdString(selectedDateObj[0].end, dateFormat.hyphen);
    return dates
      .map((date) => {
        return getDateToYmdString(date, dateFormat.hyphen);
      })
      .filter((date) => date !== start && date !== end);
  }, [selectedDateObj]);

  /** getDateToYmdStringで文字列化したselectedDateObj */
  const selectedDateYmd = useMemo(() => {
    return selectedDateObj.map((date) => {
      const start = date.start
        ? getDateToYmdString(date.start, dateFormat.hyphen)
        : '';
      const end = date.end
        ? getDateToYmdString(date.end, dateFormat.hyphen)
        : '';
      return {
        start,
        end,
      };
    });
  }, [selectedDateObj]);

  const calendarSwipe = useCalendarSwipe(calendarType);
  const calendarCell = useCalendarCellStyle({
    selectedDateObj,
    ymdBetween,
  });
  const handleCalendarCell = useHandleCalendarCell({
    selectedDateObj,
    setSelectedDateObj,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      selectedDateObj,
      setSelectedDateObj,
      selectedDateYmd,
      calendarType,
      ymdBetween,
      ...calendarSwipe,
      ...calendarCell,
      ...handleCalendarCell,
    };
  }, [
    selectedDateObj,
    setSelectedDateObj,
    selectedDateYmd,
    calendarType,
    ymdBetween,
    calendarSwipe,
    calendarCell,
    handleCalendarCell,
  ]);

  return (
    <CustomCalendarContext.Provider value={value}>
      {props.children}
    </CustomCalendarContext.Provider>
  );
};

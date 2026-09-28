import {useCallback, useContext} from 'react';
import {CalendarTaskSettingViewModalContext} from '../useCalendarTaskSettingViewModalContext';
import {CalendarViewContext} from '../useCalendarViewContext';
import type {CalendarDatePeriod} from '../../../../../types/customCalendarTypes';

export type HandleCalendarCell = {
  handlePressHomeCalendar: (dateObj: Date) => void;
  handlePressConsecutiveDates: (dateObj: Date) => void;
};

type Props = {
  selectedDateObj: CalendarDatePeriod[];
  setSelectedDateObj: React.Dispatch<
    React.SetStateAction<CalendarDatePeriod[]>
  >;
};

/** カスタムカレンダーのhooks */
export const useHandleCalendarCell: (props: Props) => HandleCalendarCell = (
  props,
) => {
  const {selectedDateObj, setSelectedDateObj} = props;
  const {saveTaskDate} = useContext(CalendarTaskSettingViewModalContext);
  const {setHomeCalendarSelectedDateObj} = useContext(CalendarViewContext);

  // ホームカレンダーの日付を押した場合
  const handlePressHomeCalendar = useCallback(
    (dateObj: Date) => {
      setSelectedDateObj([{start: dateObj, end: undefined}]);
      setHomeCalendarSelectedDateObj(dateObj);
    },
    [setHomeCalendarSelectedDateObj, setSelectedDateObj],
  );

  const handlePressConsecutiveDates = useCallback(
    (dateObj: Date) => {
      if (selectedDateObj[0].start === undefined) {
        setSelectedDateObj([{start: dateObj, end: undefined}]);
        saveTaskDate({start: dateObj, end: dateObj}); // 保存時はendにも日付を入れる
      } else if (selectedDateObj[0].start && !selectedDateObj[0].end) {
        // console.log('startだけある');
        if (dateObj.getTime() < selectedDateObj[0].start.getTime()) {
          // console.log('前の日付です');
          setSelectedDateObj([
            {
              start: dateObj,
              end: selectedDateObj[0].start,
            },
          ]);
          saveTaskDate({start: dateObj, end: selectedDateObj[0].start});
        } else if (dateObj.getTime() === selectedDateObj[0].start.getTime()) {
          // console.log('同じ日付です');
          setSelectedDateObj([
            {
              start: dateObj,
              end: undefined,
            },
          ]);
          saveTaskDate({start: dateObj, end: dateObj});
        } else {
          // console.log('先の日付です');
          setSelectedDateObj([
            {
              start: selectedDateObj[0].start,
              end: dateObj,
            },
          ]);
          saveTaskDate({start: selectedDateObj[0].start, end: dateObj});
        }
      } else if (selectedDateObj[0].start && selectedDateObj[0].end) {
        // console.log('startもendもある');
        setSelectedDateObj([{start: dateObj, end: undefined}]);
        saveTaskDate({start: dateObj, end: dateObj}); // 保存時はendにも日付を入れる
      }
    },
    [saveTaskDate, selectedDateObj, setSelectedDateObj],
  );

  // 複数日付選択
  /* const handlePressMultipleDates = useCallback(() => {
    if (isSelectedDate) {
      setSelectedYmd(selectedYmd.filter((date) => date !== ymd));
      saveTaskDate(selectedYmd.filter((date) => date !== ymd));
    } else {
      setSelectedYmd([...selectedYmd, ymd]);
      saveTaskDate([...selectedYmd, ymd]);
    }
  }, [selectedYmd, ymd, isSelectedDate, setSelectedYmd, saveTaskDate]); */

  return {
    handlePressHomeCalendar,
    handlePressConsecutiveDates,
  };
};

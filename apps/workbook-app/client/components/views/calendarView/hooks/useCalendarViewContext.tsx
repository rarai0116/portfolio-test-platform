import {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {Timestamp} from '@react-native-firebase/firestore';
import dayjs from 'dayjs';
import {
  dateFormat,
  getMdwString,
  getJapanDayBoundary,
  getTodayTimestamp,
  getYmdString,
} from '../../../functionals/timeManager';
import {getSelectedDateAllTaskSettingCardPropsList} from '../../../functionals/sortTaskSetting';
import type {SettingCardData} from '../../../hooks/useGlobalSaveDataContext';
import {TaskDataContext} from '../../../hooks/useTaskDataContext';

type CalendarViewContextObject = {
  selectedDateMdw: string;
  selectedDateTaskList: SettingCardData[];
  homeCalendarSelectedDateObj: Date;
  setHomeCalendarSelectedDateObj: (date: Date) => void;
  taskColorDisplayIdList: Record<string, Array<string | undefined>>;
};

type Props = {
  readonly children: ReactNode;
};

export const CalendarViewContext = createContext<CalendarViewContextObject>(
  {} as CalendarViewContextObject,
);

export const CalendarViewContextProvider = (props: Props) => {
  const {taskSettingListArray, taskSettingDateIdList} =
    useContext(TaskDataContext);

  // 今日 20XX-XX-XX
  const todayYmd = useMemo(() => {
    const now = getTodayTimestamp();
    return getYmdString(now, dateFormat.hyphen);
  }, []);

  /** ホームカレンダーで選択したDateオブジェクト */
  const [homeCalendarSelectedDateObj, _setHomeCalendarSelectedDateObj] =
    useState<Date>(dayjs(todayYmd).toDate());
  const setHomeCalendarSelectedDateObj = useCallback((date: Date) => {
    // console.log('setHomeCalendarSelectedDateObj', date.toISOString());
    if (Number.isNaN(date.getTime())) throw new Error('選択日が不正です');
    const newDate = new Date(date);
    _setHomeCalendarSelectedDateObj(newDate);
  }, []);

  /** 選択した日のタイムスタンプ */
  const selectedDateTimestamp = useMemo(() => {
    return Timestamp.fromDate(
      getJapanDayBoundary(homeCalendarSelectedDateObj, 'start'),
    );
  }, [homeCalendarSelectedDateObj]);

  /** XX月XX日(X) */
  const selectedDateMdw = useMemo(() => {
    return getMdwString(selectedDateTimestamp);
  }, [selectedDateTimestamp]);

  /** 選択した日のタスクリスト */
  const selectedDateTaskList = useMemo(() => {
    return getSelectedDateAllTaskSettingCardPropsList(
      taskSettingListArray,
      selectedDateTimestamp,
    );
  }, [taskSettingListArray, selectedDateTimestamp]);

  /** タスクの色を表示するためのidリスト */
  // components/views/calendarView/hooks/useCalendarViewContext.tsx
  const taskColorDisplayIdList = useMemo(() => {
    const _startTime = performance.now();

    const result: Record<string, Array<string | undefined>> = {};

    // 1. sortedTaskIdListへの依存を削除し、単純な処理に変更
    for (const [timestamp, taskIdList] of Object.entries(
      taskSettingDateIdList,
    )) {
      // 2. 最大4つまでのタスクを表示し、残りは切り捨て
      const displayTasks = taskIdList.slice(0, 4);

      // 3. undefinedでパディングして4つの要素を保証
      const paddedTasks = displayTasks.concat(
        Array.from({length: Math.max(0, 4 - displayTasks.length)}).fill(
          '',
        ) as string[],
      );

      result[timestamp] = paddedTasks;
    }

    const _endTime = performance.now();

    return result;
  }, [taskSettingDateIdList]); // sortedTaskIdListを依存関係から削除
  /*
  const taskColorDisplayIdList = useMemo(() => {
    // taskIdListをstartAt日付の順に並び替える
    const taskStartDateList = Object.entries(taskSettingList).reduce<
      Record<string, number | undefined>
    >((acc, [taskId, task]) => {
      // 日本時間(UTC+9)に合わせる
      if (task.taskSetting?.deadlineDate) {
        acc[taskId] = task.taskSetting.deadlineDate.seconds + 9 * 60 * 60;
      } else if (task.taskSetting?.taskDate?.[0]?.startAt) {
        acc[taskId] =
          task.taskSetting.taskDate[0].startAt.seconds + 9 * 60 * 60;
      }

      return acc;
    }, {});

    const sortedTaskIdList = Object.entries(taskStartDateList)
      .sort((a, b) => {
        if (a[1] && b[1]) {
          return Number(a[1]) - Number(b[1]);
        }

        return 0;
      })
      .map(([taskId, timestamp]) => taskId);
    const dateList = Object.keys(taskSettingDateIdList); // 日付のリスト
    const rowList: Record<number, Array<string | undefined>> = Array.from({
      length: dateList.length,
    }).reduce<Record<number, Array<string | undefined>>>((acc, _, i) => {
      acc[i] = Array.from({length: sortedTaskIdList.length});
      return acc;
    }, {});

    Object.entries(taskSettingDateIdList).map(([timestamp, dateIdList], j) => {
      return sortedTaskIdList.map((id, k) => {
        if (!id) return;
        if (dateIdList.includes(id)) {
          if (
            j > 0 && // 前の日に含まれていない場合
            !Object.values(taskSettingDateIdList)[j - 1].includes(id)
          ) {
            const undefinedIndex = rowList[j].indexOf(undefined);
            rowList[j][undefinedIndex] = id;
          } else if (
            j > 0 && // 前の日に含まれている場合
            Object.values(taskSettingDateIdList)[j - 1].includes(id)
          ) {
            const previousIndex = rowList[j - 1].indexOf(id);
            rowList[j][previousIndex] = id;
          } else {
            // 一番最初の日付の場合
            const undefinedIndex = rowList[j].indexOf(undefined);
            rowList[j][undefinedIndex] = id;
          }
        }

        return id;
      });
    });

    // keyをdateKeyにするとj-1が取得できないため、ここでkeyを変更
    const newRowList = Object.keys(taskSettingDateIdList).reduce<
      Record<string, Array<string | undefined>>
    >((acc, dateKey, index) => {
      acc[dateKey] = rowList[index];

      // 配列の末尾にあるundefinedを削除。要素の間のundefinedは保持
      let i = acc[dateKey].length - 1;
      while (i >= 0) {
        if (acc[dateKey][i] !== undefined) return acc;
        if (acc[dateKey][i] === undefined) {
          acc[dateKey].splice(i, 1);
        }

        i--;
      }

      acc[dateKey].slice(0, i + 1);
      return acc;
    }, {});

    return newRowList;
  }, [taskSettingDateIdList, taskSettingList]);
*/
  /*
  useEffect(() => {
    console.log('taskColorDisplayIdList', taskColorDisplayIdList);
  }, [taskColorDisplayIdList]);
  */

  const value = useMemo(() => {
    return {
      homeCalendarSelectedDateObj,
      setHomeCalendarSelectedDateObj,
      selectedDateMdw,
      selectedDateTaskList,
      taskColorDisplayIdList,
    };
  }, [
    homeCalendarSelectedDateObj,
    setHomeCalendarSelectedDateObj,
    selectedDateMdw,
    selectedDateTaskList,
    taskColorDisplayIdList,
  ]);

  return (
    <CalendarViewContext.Provider value={value}>
      {props.children}
    </CalendarViewContext.Provider>
  );
};

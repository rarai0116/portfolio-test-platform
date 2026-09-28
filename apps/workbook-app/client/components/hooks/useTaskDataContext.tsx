import {createContext, useContext, useMemo, type ReactNode} from 'react';
import {getJapanTime} from '../functionals/japanTime';
import {getDatesBetweenString} from '../functionals/timeManager';
import {
  GlobalSaveDataContext,
  type SettingCardData,
  type SettingCardDataMap,
} from './useGlobalSaveDataContext';
type TaskDataContextObject = {
  taskSettingListArray: SettingCardData[];
  taskSettingList: SettingCardDataMap;
  taskSettingDateIdList: Record<string, string[]>;
};

type Props = {
  readonly children: ReactNode;
};

export const TaskDataContext = createContext<TaskDataContextObject>(
  {} as TaskDataContextObject,
);

export type DateKeySettingCardDataMap = Record<string, SettingCardDataMap>;

export const TaskDataContextProvider = (props: Props) => {
  const {savedSettingList} = useContext(GlobalSaveDataContext);

  const taskSettingListArray: SettingCardData[] = useMemo(() => {
    console.log('taskSettingListArray更新');
    return Object.values(savedSettingList).filter((v) => v.id.includes('task'));
  }, [savedSettingList]);

  const taskSettingList: SettingCardDataMap = useMemo(() => {
    return Object.keys(savedSettingList).reduce((acc, key) => {
      if (key.includes('task')) {
        return {
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          ...acc,
          [key]: savedSettingList[key],
        };
      }

      return acc;
    }, {});
  }, [savedSettingList]);

  /** 課題の設定データから日付ごとにIDをまとめたオブジェクト */
  const taskSettingDateIdList: Record<string, string[]> = useMemo(() => {
    return Object.values(taskSettingList).reduce<Record<string, string[]>>(
      (acc, data) => {
        if (!data.taskSetting) return acc;

        if (data.taskSetting.deadlineDate) {
          const date = data.taskSetting.deadlineDate.toDate();
          const dateString = getJapanTime(date).format('YYYYMMDD');
          return {
            // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
            ...acc,
            [dateString]: [...(acc[dateString] || []), data.id],
          };
        }

        if (data.taskSetting.taskDate) {
          const currentDateStrings = data.taskSetting.taskDate.flatMap(
            (v, _i) => {
              /* console.log(
                data.id,
                'taskSettingDateIdList: startAt',
                v.startAt.toDate().toISOString(),
                'endAt',
                v.endAt.toDate().toISOString(),
              );
              */
              // 各{startAt,endAt}の間の日付を取得
              const datesStrings = getDatesBetweenString(
                v.startAt,
                v.endAt,
                'none',
              );
              // console.log(datesStrings);

              return datesStrings;
            },
          );
          for (const dateString of currentDateStrings) {
            acc[dateString] ??= [];
            acc[dateString].push(data.id);
          }
        }

        return acc;
      },
      {},
    );
  }, [taskSettingList]);

  const value = useMemo(() => {
    return {
      taskSettingListArray,
      taskSettingList,
      taskSettingDateIdList,
    };
  }, [taskSettingListArray, taskSettingList, taskSettingDateIdList]);

  return (
    <TaskDataContext.Provider value={value}>
      {props.children}
    </TaskDataContext.Provider>
  );
};

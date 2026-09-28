import {useContext, useMemo} from 'react';
import {isExpired} from '@functionals/sortTaskSetting';
import {questionState} from 'commonUnionType';
import type {SettingCardData} from '@hooks/useGlobalSaveDataContext';
import {TaskDataContext} from '@hooks/useTaskDataContext';
import {
  dateFormat,
  getDatesBetweenString,
  getTodayTimestamp,
  getYmdString,
} from '@/components/functionals/timeManager';

type TaskSettingCardPropsListKey = 'today' | 'user' | 'teacher';
export type TaskSettingCardPropsListSecondaryKey =
  | 'inComplete'
  | 'completed'
  | 'all';
export type TaskSettingCardList = Record<
  TaskSettingCardPropsListKey,
  Record<TaskSettingCardPropsListSecondaryKey, React.JSX.Element[]>
>;
export type TaskMode = {
  taskSettingCardIdList: TaskCategories;
  //  taskSettingCardList: TaskSettingCardList;
};

type TaskCategories = {
  today: {
    incomplete: string[];
    completed: string[];
    all: string[];
  };
  user: {
    incomplete: string[];
    completed: string[];
    all: string[];
  };
  teacher: {
    incomplete: string[];
    completed: string[];
    all: string[];
  };
};

type Props = {
  readonly onPressOutTaskSettingCard: (
    id: string,
    cardData?: SettingCardData | null,
  ) => void;
};

const useTask: (props: Props) => TaskMode = (_props) => {
  const {taskSettingListArray} = useContext(TaskDataContext);

  const taskSettingCardIdList = useMemo(() => {
    const now = getTodayTimestamp();
    const todayString = getYmdString(now, dateFormat.slash);

    return taskSettingListArray.reduce<TaskCategories>(
      (categories, task) => {
        if (!task.taskSetting?.hasTask) return categories;
        const {id} = task;
        const taskDate = task.taskSetting?.taskDate
          ? task.taskSetting?.taskDate.flatMap((v) => {
              const dateStrings = getDatesBetweenString(
                v.startAt,
                v.endAt,
                dateFormat.slash,
              );
              return dateStrings;
            })
          : [];
        const isToday = taskDate.includes(todayString);
        const isExpiredTask = isExpired(task, now);
        const isTeacherTask = task.taskSetting?.isTeacher;
        const isIncomplete =
          task.taskSetting?.taskState !== questionState.completed;
        const isAbleToAnswerAfterDeadline =
          task.taskSetting?.isAbleToAnswerAfterDeadline;

        // 今日の課題
        if (isToday) {
          categories.today.all.push(id);
          if (
            isIncomplete ||
            (isExpiredTask && isTeacherTask && isAbleToAnswerAfterDeadline)
          ) {
            categories.today.incomplete.push(id);
          } else {
            categories.today.completed.push(id);
          }
        }

        // 講師の課題
        if (isTeacherTask) {
          categories.teacher.all.push(id);
          if (isIncomplete || (isExpiredTask && isAbleToAnswerAfterDeadline)) {
            categories.teacher.incomplete.push(id);
          } else {
            categories.teacher.completed.push(id);
          }
        } else {
          // ユーザーの課題
          categories.user.all.push(id);
          if (isIncomplete) {
            categories.user.incomplete.push(id);
          } else {
            categories.user.completed.push(id);
          }
        }

        return categories;
      },
      {
        today: {incomplete: [], completed: [], all: []},
        user: {incomplete: [], completed: [], all: []},
        teacher: {incomplete: [], completed: [], all: []},
      },
    );
  }, [taskSettingListArray]);

  // 選択したタブに応じて表示する課題を変更
  /*
  const taskSettingCardPropsList: TaskSettingCardPropsList = useMemo(() => {
    const today = getTodayAllTaskSettingCardPropsList(taskSettingListArray);
    const user = getUserAllTaskSettingCardPropsList(taskSettingListArray);
    const teacher = getTeacherAllTaskSettingCardPropsList(taskSettingListArray);

    return {
      today: {
        inComplete: getInCompleteTaskSettingCardPropsList(today).concat(
          getExpiredTaskSettingCardPropsList(
            taskSettingListArray,
            taskPrimaryTab.today,
          ),
        ),
        completed: getCompletedTaskSettingCardPropsList(today),
        all: today.concat(
          getExpiredTaskSettingCardPropsList(
            taskSettingListArray,
            taskPrimaryTab.today,
          ),
        ),
      },
      user: {
        inComplete: getInCompleteTaskSettingCardPropsList(user),
        completed: getCompletedTaskSettingCardPropsList(user),
        all: user,
      },
      teacher: {
        inComplete: getInCompleteTaskSettingCardPropsList(teacher),
        completed: getCompletedTaskSettingCardPropsList(teacher),
        all: teacher,
      },
    };
  }, [taskSettingListArray]);

  const taskSettingCardList: TaskSettingCardList = useMemo(() => {
    console.log('taskSettingCardPropsList!', taskSettingCardPropsList);
    const keys = Object.keys(
      taskSettingCardPropsList,
    ) as TaskSettingCardPropsListKey[];

    return keys.reduce(
      (acc, key) => {
        const secondaryKeys = Object.keys(
          taskSettingCardPropsList[key],
        ) as TaskSettingCardPropsListSecondaryKey[];
        const keyList: TaskSettingCardPropsSecondaryList =
          secondaryKeys.reduce<TaskSettingCardPropsSecondaryList>(
            (acc2, key2) => {
              const ids = taskSettingCardPropsList[key][key2].map((v) => v.id);
              return {
                ...acc2,
                [key2]: displaySettingCardList(
                  ids,
                  'task',
                  false,
                  props.onPressOutTaskSettingCard,
                ),
              };
            },
            {
              inComplete: [],
              completed: [],
              all: [],
            },
          );
        return {
          ...acc,
          [key]: keyList,
        };
      },
      {
        today: {
          inComplete: [],
          completed: [],
          all: [],
        },
        user: {
          inComplete: [],
          completed: [],
          all: [],
        },
        teacher: {
          inComplete: [],
          completed: [],
          all: [],
        },
      },
    );
  }, [taskSettingCardPropsList, props.onPressOutTaskSettingCard]);
  */

  return {taskSettingCardIdList};
};

export default useTask;

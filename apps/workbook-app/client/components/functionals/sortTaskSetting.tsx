import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  type TaskPrimaryTabType,
  questionState,
  taskPrimaryTab,
} from '../../types/commonUnionType';
import type {SettingCardData} from '../hooks/useGlobalSaveDataContext';
import {
  dateFormat,
  getDatesBetweenString,
  getTodayTimestamp,
  getYmdString,
} from './timeManager';

// 選択した日の課題を取得
export const getSelectedDateAllTaskSettingCardPropsList: (
  allTask: SettingCardData[],
  date: FirebaseFirestoreTypes.Timestamp,
) => SettingCardData[] = (
  allTask: SettingCardData[],
  date: FirebaseFirestoreTypes.Timestamp,
) => {
  if (!date) return [];
  // JST(UTC+9)のカレンダー日インデックス(1日=1)に変換して境界比較する。
  // 以前は開始～終了の全日付文字列を毎回生成してSet.hasしていたが、
  // 期間の広いタスク × 多数 × 毎選択で重く(Profilerで provider 自己 685ms×2)、
  // 等価な O(1) の境界比較に置換した(アプリはAsia/Tokyo固定前提)。
  const jstDay = (ts: FirebaseFirestoreTypes.Timestamp) =>
    Math.floor((ts.seconds + 9 * 60 * 60) / 86_400);
  const selDay = jstDay(date);
  return allTask.filter((task) => {
    if (!task.taskSetting) return false;
    // if(!task.taskSetting.hasTask) return false; カレンダーではhasTaskがfalseのものも表示
    if (task.taskSetting.deadlineDate) {
      return jstDay(task.taskSetting.deadlineDate) === selDay;
    }

    if (task.taskSetting.taskDate) {
      return task.taskSetting.taskDate.some((v) => {
        if (!v.startAt || !v.endAt) {
          console.error('startAt or endAt is undefined', v);
          return false;
        }

        return jstDay(v.startAt) <= selDay && selDay <= jstDay(v.endAt);
      });
    }

    return false;
  });
};

// 今日の課題を取得
export const getTodayAllTaskSettingCardPropsList: (
  allTask: SettingCardData[],
) => SettingCardData[] = (allTask: SettingCardData[]) => {
  const result = allTask.filter((task) => {
    const now = getTodayTimestamp();
    const today: string = getYmdString(now, dateFormat.slash);
    try {
      if (!task.taskSetting?.hasTask) return false;

      if (task.taskSetting.deadlineDate) {
        const deadlineDate = getYmdString(
          task.taskSetting.deadlineDate,
          dateFormat.slash,
        );
        return deadlineDate.includes(today);
      }

      if (task.taskSetting.taskDate) {
        const taskDates = task.taskSetting.taskDate.flatMap((v) => {
          const dateStrings = getDatesBetweenString(
            v.startAt,
            v.endAt,
            dateFormat.slash,
          );
          /*          const dateStrings = dates.map((date) =>
            getDateToYmdString(date, dateFormat.slash),
          );
*/
          return dateStrings;
        });

        return taskDates.includes(today);
      }

      return false;
    } catch {
      throw new Error('getTodayAllTaskSettingCardPropsList Error');
    }
  });
  return result;
};

// ユーザーの課題を取得（期限切れは含まない）
export const getUserAllTaskSettingCardPropsList: (
  allTask: SettingCardData[],
) => SettingCardData[] = (allTask: SettingCardData[]) => {
  return allTask.filter((task) => {
    if (!task.taskSetting?.hasTask) return false;
    return !task.taskSetting?.isTeacher && !isExpired(task);
  });
};

// 講師の課題を取得
export const getTeacherAllTaskSettingCardPropsList: (
  allTask: SettingCardData[],
) => SettingCardData[] = (allTask: SettingCardData[]) => {
  return allTask.filter((task) => {
    if (!task.taskSetting) return false;
    return task.taskSetting?.isTeacher;
  });
};

/**
 * 期限切れの課題を取得
 * @param alltask 課題データ
 * @param taskTab 今日・あなた・講師のタブのいずれか
 */

export const getExpiredTaskSettingCardPropsList: (
  allTask: SettingCardData[],
  taskTab: TaskPrimaryTabType,
) => SettingCardData[] = (
  allTask: SettingCardData[],
  taskTab: TaskPrimaryTabType,
) => {
  return allTask
    .filter((task) => {
      if (!task.taskSetting?.hasTask || !task.taskSetting?.deadlineDate)
        return false;
      if (taskTab === taskPrimaryTab.today) {
        return (
          isExpired(task) && task.isTeacher && task.isAbleToAnswerAfterDeadline
        );
      }

      return isExpired(task);
    })
    .map((v) => {
      v.taskSetting!.isExpired = true;
      return v;
    });
};

export const isExpired: (
  task: SettingCardData,
  now?: FirebaseFirestoreTypes.Timestamp,
) => boolean = (
  task: SettingCardData,
  now?: FirebaseFirestoreTypes.Timestamp,
) => {
  now ??= getTodayTimestamp();
  if (!task.taskSetting?.deadlineDate) return false;
  const deadlineTime = task.taskSetting.deadlineDate;
  return deadlineTime.toDate() < now.toDate();
};

/**
 * 未完了の課題を取得
 * @param task 今日・あなた・講師の各タブの課題データ
 */
export const getInCompleteTaskSettingCardPropsList: (
  task: SettingCardData[],
) => SettingCardData[] = (task: SettingCardData[]) => {
  return task.filter((task) => {
    if (!task.taskSetting?.hasTask || !task.taskSetting?.taskDate) return false;
    return (
      task.taskSetting?.isAbleToAnswerAfterDeadline &&
      (task.taskSetting?.taskState === questionState.notStarted ||
        task.taskSetting?.taskState === questionState.progress)
    );
  });
};

/**
 * 完了した課題を取得
 * @param task 今日・あなた・講師の各タブの課題データ
 */
export const getCompletedTaskSettingCardPropsList: (
  task: SettingCardData[],
) => SettingCardData[] = (task: SettingCardData[]) => {
  return task.filter((task) => {
    if (!task.taskSetting?.hasTask) return false;
    return task.taskSetting?.taskState === questionState.completed;
  });
};

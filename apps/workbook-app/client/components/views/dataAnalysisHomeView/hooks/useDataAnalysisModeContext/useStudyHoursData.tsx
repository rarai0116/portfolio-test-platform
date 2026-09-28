import {useContext, useMemo} from 'react';
import {GlobalUserSettingContext} from '../../../../hooks/useGlobalUserSettingContext';
import {getTodayTimestamp} from '../../../../functionals/timeManager';
import {
  getPastTimestamp,
  formatTimestamp,
} from '../../../../functionals/firestoreController';

export type StudyHoursData = {
  consecutiveStudyDays: number;
  todaysStudyHours: number;
  totalStudyDays: number;
  totalStudyHours: number;
  weeklyStudyHourList: Array<[Date, number]>;
  weeklyMaxStudyHour: number;
};
const useStudyHoursData: () => StudyHoursData = () => {
  const {oldDailyLogStore, userData, currentDailyLog, grade, readyForTest} =
    useContext(GlobalUserSettingContext);
  const {
    consecutiveStudyDays,
    todaysStudyHours,
    totalStudyDays,
    pastSixDaysStudyHourList,
    // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  } = useMemo(() => {
    if (readyForTest.isUser || !currentDailyLog) {
      return {
        consecutiveStudyDays: 0,
        todaysStudyHours: 0,
        totalStudyDays: 0,
        pastSixDaysStudyHourList: [0, 0, 0, 0, 0, 0],
      };
    }

    // 今日の学習時間

    const todaysStudyHours = currentDailyLog!.durationTime.reduce(
      (acc, cur) => acc + cur,
      0,
    );
    const pastSixDaysStudyHourList = [];
    // 連続勉強日数(oldDailyLogStoreのキーはyyyymmdd形式の日付)
    const consecutiveStudyDays = (() => {
      let count = todaysStudyHours > 0 ? 1 : 0;
      let isConsecutive = true;
      // nowから昨日〜7日前の日付のoldDayLogStoreのキーから^YYYYMMDD_[12]_*の形式のidを持つdailyLogを取得する
      // そのdailyLogのdurationTimeの合計が0でなければcountをインクリメントする
      const keys = Object.keys(oldDailyLogStore);

      for (let i = 1; i < 7; i++) {
        const date = getPastTimestamp(i);
        const id = formatTimestamp(date, 'YYYYMMDD');

        // const pattern = new RegExp(`^${id}_[12]_.*`);
        const key = keys.find((key) => key === id);

        if (key) {
          const dailyLog = oldDailyLogStore[key];
          if (dailyLog.answerList.length === 0) isConsecutive = false; // 連続日数カウントを終了
          if (isConsecutive) count++;
          const studyHour = dailyLog.durationTime.reduce(
            (acc, cur) => acc + cur,
            0,
          );
          pastSixDaysStudyHourList.push(studyHour);
        } else {
          isConsecutive = false;
          pastSixDaysStudyHourList.push(0);
        }
      }

      return count;
    })();

    const totalStudyDays =
      Object.values(oldDailyLogStore).reduce(
        (acc, cur) => acc + (cur.answerList.length > 0 ? 1 : 0),
        0,
      ) + (currentDailyLog!.answerList.length > 0 ? 1 : 0);
    return {
      consecutiveStudyDays,
      todaysStudyHours,
      totalStudyDays,
      pastSixDaysStudyHourList,
    };
    // readyForTestの更新で再計算しないように調整
  }, [oldDailyLogStore, currentDailyLog]);
  const totalStudyHours = useMemo(() => {
    if (!currentDailyLog) return 0;
    const playTime =
      grade === '1級'
        ? (userData?.personalAnalysis.firstGrade.totalPlayTime ?? 0)
        : (userData?.personalAnalysis.secondGrade.totalPlayTime ?? 0); // userData?.personalAnalysis.playTime._total ?? 0;
    return (
      playTime +
      currentDailyLog!.durationTime.reduce((acc, cur) => acc + cur, 0)
    );
  }, [userData, currentDailyLog, grade]);

  const weeklyStudyHourList: Array<[Date, number]> = useMemo(() => {
    if (!currentDailyLog) return [];
    const todayHourTime = currentDailyLog!.durationTime.reduce(
      (acc, cur) => acc + cur,
      0,
    );
    const todayHour: [Date, number] = [
      getTodayTimestamp().toDate(),
      todayHourTime,
    ];
    const pastSixDaysStudyHourMap: Array<[Date, number]> =
      pastSixDaysStudyHourList.map((hour, i) => [
        getPastTimestamp(i + 1).toDate(),
        hour,
      ]);

    return [todayHour, ...pastSixDaysStudyHourMap];
  }, [currentDailyLog, pastSixDaysStudyHourList]);

  const weeklyMaxStudyHour = useMemo(() => {
    return Math.max(...weeklyStudyHourList.map(([_date, ms], _i) => ms));
  }, [weeklyStudyHourList]);

  return {
    consecutiveStudyDays,
    todaysStudyHours,
    totalStudyDays,
    totalStudyHours,
    weeklyStudyHourList,
    weeklyMaxStudyHour,
  };
};

export default useStudyHoursData;

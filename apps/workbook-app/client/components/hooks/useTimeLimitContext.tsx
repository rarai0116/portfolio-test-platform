import {createContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import type {TimeState} from './useInterval';
import useInterval from './useInterval';

type TimeLimit = number;

type TimeLimitContextObject = {
  timeLimit: TimeLimit;
  timeLeftPercent: number;
  setTimeLeftPercent: React.Dispatch<React.SetStateAction<number>>;
  count: number;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  changePercent: number;
  timeState: TimeState;
  startTime: () => void;
  stopTime: () => void;
};

type Props = {
  readonly children: ReactNode;
  readonly timeLimit: TimeLimit;
  readonly onTimeLimitEnd?: () => void;
  readonly durationTime?: number | null;
};

export const TimeLimitContext = createContext<TimeLimitContextObject>(
  {} as TimeLimitContextObject,
);

export const TimeLimitContextProvider = (props: Props) => {
  const {timeLimit, changePercent, durationTimePercent} = useMemo(() => {
    const timeLimit: TimeLimit = props.timeLimit;
    const timeLimitSecond = timeLimit / 1000;
    // 1秒あたりの変化率
    // timeLimit(ms)で100%減り、1秒でx%減るようにしたい
    const changePercent: number = 100 / timeLimitSecond;
    // 経過時間の割合
    const durationTimePercent = props.durationTime
      ? (props.durationTime / props.timeLimit) * 100
      : 0;
    return {
      timeLimit,
      timeLimitSecond,
      changePercent,
      durationTimePercent,
    };
  }, [props.timeLimit, props.durationTime]);

  const [timeLeftPercent, setTimeLeftPercent] = useState<number>(
    100 - durationTimePercent,
  );
  const [count, setCount] = useState<number>(0);

  const [timeState, {startTime, stopTime}] = useInterval({
    // 1秒ごとの処理
    fn() {
      setTimeLeftPercent((previous) => previous - changePercent);
      setCount((previous) => previous + 1);
      if (timeLeftPercent - changePercent <= 0) {
        stopTime();
        if (props.onTimeLimitEnd) props.onTimeLimitEnd();
      }
      // console.log('count', count);
      // console.log('timeLeftPercent', timeLeftPercent);
      // console.log('changePercent', changePercent);
    },
    interval: 1000, // ms
    autostart: false,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      timeLimit,
      timeLeftPercent,
      setTimeLeftPercent,
      count,
      setCount,
      changePercent,
      startTime,
      stopTime,
      timeState,
    };
  }, [
    timeLimit,
    timeLeftPercent,
    setTimeLeftPercent,
    count,
    setCount,
    changePercent,
    startTime,
    stopTime,
    timeState,
  ]);

  return (
    <TimeLimitContext.Provider value={value}>
      {props.children}
    </TimeLimitContext.Provider>
  );
};

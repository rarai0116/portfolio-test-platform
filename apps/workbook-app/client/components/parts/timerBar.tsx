import {useCallback, useEffect, useContext, useMemo} from 'react';
import {View} from 'react-native';
import tw from '../../tailwind.custom';
import {TimeLimitContext} from '../hooks/useTimeLimitContext';
import AppText from '../identities/appText';
import Bar from '../identities/bar';
import {timeUnitConverter} from '../functionals/timeManager';
import {QuestionAndChoicesViewContext} from '../hooks/useQuestionsAndChoicesViewContext';
import Spacer from './spacer';

export type TimerBarProps = {
  readonly isTimerVisible: boolean;
  readonly width: number;
  readonly textStyle?: string;
  readonly isStart: boolean;
};

const TimerBar = (props: TimerBarProps) => {
  const {isTimerVisible = true, textStyle = ''} = props; // 初期値
  const {isAnswerMode, testDurationTime, isAborted} = useContext(
    QuestionAndChoicesViewContext,
  );
  const {timeLimit, timeLeftPercent, startTime, stopTime, count} =
    useContext(TimeLimitContext);
  // const [isStartTimer, setIsStartTimer] = useState<boolean>(isStart);
  const isStartTimer = useMemo(() => {
    return !(isAnswerMode || isAborted);
  }, [isAnswerMode, isAborted]);

  /*
  useEffect(() => {
    //    console.log('isStart,', isStart);
    setIsStartTimer(isStart);
  }, [isStart]);
  */

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    //   console.log('isStartTimer', isStartTimer);
    if (isStartTimer) {
      startTime();
      //      setTestDurationTime(testDurationTime); // タイマー初期化
    } else {
      stopTime();
    }
  }, [isStartTimer]);

  const decreaseTime = useCallback(() => {
    //    const newTime = testDurationTime + 1000;
    //    console.log('testDurationTime', testDurationTime);
    testDurationTime.current += 1000;
  }, [testDurationTime]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    //   console.log('count', count);
    if (count !== 0) {
      decreaseTime();
    }
  }, [count]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    //    console.log('timeLeftPercent', timeLeftPercent);
    if (timeLeftPercent <= 0) {
      stopTime();
    }
  }, [timeLeftPercent]);

  /*
  useEffect(() => {
    //    console.log('isAnswerMode', isAnswerMode);
    if (isAnswerMode || isAborted) {
      setIsStartTimer(false);
    } else {
      setIsStartTimer(true);
    }
  }, [isAnswerMode, isAborted]);
  */

  /*
  const displayTime = useMemo(() => {
    console.log('testDurationTime', testDurationTime);
    return timeUnitConverter(timeLimit - testDurationTime.current);
  }, [testDurationTime, timeLimit]);
  */

  const barWidth = useMemo(() => {
    // spacerとdisplayTimeの幅を引いたもの
    return props.width - 2 - 64;
  }, [props.width]);

  return (
    <>
      <Bar
        barStyle={{
          container: `w-[${barWidth}px] h-1 bg-quaternary rounded-2xl clipPath_round`,
          bar: 'h-1 bg-workbookblue-500 rounded-l-2xl',
          borderRadius: 'rounded-r-2xl',
        }}
        percent={timeLeftPercent}
      />
      {isTimerVisible ? (
        <>
          <Spacer isHorizontal size={2} />
          <View
          /* onLayout={(e) => {
              console.log('stringlayout', e.nativeEvent.layout.width); // max 64px
            }} */
          >
            <AppText style={tw`${textStyle}`}>
              {timeUnitConverter(timeLimit - testDurationTime.current)}
            </AppText>
          </View>
        </>
      ) : null}
    </>
  );
};

export default TimerBar;

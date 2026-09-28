import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AlarmClockIcon from '../../assets/svg/alarm-clock_time-left.svg';
import TimerBar from './timerBar';
import Spacer from './spacer';

export type TimerBarPartProps = {
  readonly isStart: boolean;
  readonly width: number;
};

const TimerBarPart = (props: TimerBarPartProps) => {
  const timerBarWidth = useMemo(() => {
    // IconとSpacerの幅を引いたもの
    return props.width - 16 - 2;
  }, [props.width]);

  return (
    <View style={tw`w-full flex-row items-center`}>
      <AlarmClockIcon />
      <Spacer isHorizontal size={2} />
      <TimerBar
        isTimerVisible
        width={timerBarWidth}
        isStart={props.isStart}
        textStyle="text-xs text-secondary -tracking-0.2"
      />
    </View>
  );
};

export default TimerBarPart;

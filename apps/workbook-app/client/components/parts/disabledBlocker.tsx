import {useEffect, useMemo, useContext} from 'react';
import {View} from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import AppText from '../identities/appText';
import tw from '../../tailwind.custom';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';

type CircleProps = {
  readonly size: number;
  readonly color: string;
  readonly delay: number;
};
const Circle = ({size, color, delay}: CircleProps) => {
  const translateY = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const duration = 500;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-20, {
          duration,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        true,
      ),
    );
    scaleX.value = withDelay(
      delay + duration * 1.5,
      withRepeat(
        withTiming(1.2, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
  }, [translateY, delay, scaleX, size]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: translateY.value}, {scaleX: scaleX.value}],
  }));

  return (
    <Animated.View
      style={[
        tw`rounded-full`,
        {
          width: size,
          height: size,
          backgroundColor: color,
          margin: 5, // 一定間隔を設定
          scaleX: 0.5,
        },
        animatedStyle,
      ]}
    />
  );
};

const DisabledBlocker = () => {
  const {isDisabledInput} = useContext(GlobalUserSettingContext);

  const {size, color, delay} = useMemo(() => {
    return {size: 6, color: '#289DF4', delay: 120};
  }, []);

  if (!isDisabledInput) return null;

  return (
    <View
      style={tw`absolute w-full h-110% bg-black bg-opacity-20 z-100 flex-1 justify-center items-center mt-[-20]`}
    >
      <View
        style={tw`flex-col bg-white w-120px h-120px justify-center items-center rounded-lg bg-opacity-70`}
      >
        <View style={tw`flex-row justify-center`}>
          <Circle size={size} color={color} delay={0} />
          <Circle size={size} color={color} delay={delay} />
          <Circle size={size} color={color} delay={delay * 2} />
          <Circle size={size} color={color} delay={delay * 3} />
        </View>
        <AppText style={tw`text-gray-800 mt-2 `}>通信中...</AppText>
      </View>
    </View>
  );
};

export default DisabledBlocker;

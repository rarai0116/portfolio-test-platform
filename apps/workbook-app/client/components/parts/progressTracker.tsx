import {View, useWindowDimensions} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {useMemo} from 'react';
import type {SharedValue} from 'react-native-reanimated';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type ProgressTrackerProps = {
  readonly dataLength: number;
  readonly currentIndex: number | null;
  readonly scrollX: SharedValue<number>;
};

export type AnimatedCircleProps = {
  readonly scrollX: SharedValue<number>;
  readonly index: number;
  readonly width: number;
  readonly circleStyleArray: Array<{
    textColor: string;
    content: string;
  }>;
};

const AnimatedCircle = (props: AnimatedCircleProps) => {
  const i = props.index;
  const width = props.width;
  const circleStyleArray = props.circleStyleArray;

  const key = `circle_${i}`;
  const circleAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
    const backgroundColor = interpolateColor(props.scrollX.value, inputRange, [
      '#ECECEC',
      '#66C365',
      '#FFFFFF',
    ]);
    const borderColor = interpolateColor(props.scrollX.value, inputRange, [
      '#ECECEC',
      '#66C365',
      '#66C365',
    ]);
    return {
      backgroundColor,
      borderColor,
    };
  });
  const barAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
    const backgroundColor = interpolateColor(props.scrollX.value, inputRange, [
      '#ECECEC',
      '#66C365',
      '#66C365',
    ]);
    return {
      backgroundColor,
    };
  });
  return (
    <View key={key} style={tw`flex-row items-center`}>
      {i > 0 ? (
        <Animated.View style={[tw`w-8 h-1 `, barAnimatedStyle]} />
      ) : null}
      <Animated.View
        style={[
          tw`rounded-full w-7 h-7 items-center justify-center border border-solid`,
          circleAnimatedStyle,
        ]}
      >
        <AppText style={tw`${circleStyleArray[i].textColor}`}>{i + 1}</AppText>
      </Animated.View>
    </View>
  );
};

const ProgressTracker = (props: ProgressTrackerProps) => {
  const width = useWindowDimensions().width;
  const length = props.dataLength;

  const circleStyle = useMemo(() => {
    return {
      previous: {
        textColor: 'text-successgreen-400',
        content: '',
      },
      current: {
        textColor: 'text-white',
        content: '',
      },
      next: {
        textColor: 'text-tertiary',
        content: '',
      },
      default: {
        textColor: '',
        content: '',
      },
    };
  }, []);

  const circleStyleArray = useMemo(() => {
    return Array.from({length}).map((_v, i) => {
      if (props.currentIndex !== null) {
        if (props.currentIndex > i) {
          return circleStyle.previous;
        }

        if (props.currentIndex === i) {
          return circleStyle.current;
        }

        return circleStyle.next;
      }

      return circleStyle.default;
    });
  }, [props.currentIndex, circleStyle, length]);

  const animatedCircles = useMemo(() => {
    return Array.from({length}).map((_, i) => {
      const key = `circle_${i}`;
      return (
        <AnimatedCircle
          key={key}
          scrollX={props.scrollX}
          index={i}
          width={width}
          circleStyleArray={circleStyleArray}
        />
      );
    });
  }, [circleStyleArray, props.scrollX, length, width]);

  return <View style={tw`flex-row `}>{animatedCircles}</View>;
};

export default ProgressTracker;

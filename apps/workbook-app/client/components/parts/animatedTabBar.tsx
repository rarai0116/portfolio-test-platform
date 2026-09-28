import type React from 'react';
import {useEffect} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';

type AnimatedTabBarProps = BottomTabBarProps & {
  readonly isHidden?: boolean;
  readonly children?: React.ReactNode;
};

const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  isHidden = false,
  children,
  ..._rest
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(isHidden ? 0 : 1, {
      duration: 300,
    });
  }, [isHidden, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
  },
});

export default AnimatedTabBar;

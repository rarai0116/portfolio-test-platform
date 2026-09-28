import {useCallback, useEffect, useState} from 'react';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  KeyboardEvents,
  type KeyboardEventData,
} from 'react-native-keyboard-controller';

export type KeyboardAvoid = {
  isKeyboardVisible: boolean; // animatedPadding は Animated.StyleProp に使える値を持つshared valueとする
  readonly animatedPadding: {value: number};
  readonly animatedStyle: ReturnType<typeof useAnimatedStyle>;
};

const useKeyboardAvoid = (): KeyboardAvoid => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const hasHomeBar = insets.bottom > 0;

  // キーボードの物理高さをshared valueで管理
  const keyboardHeight = useSharedValue(0);
  // アニメーション進行状況をshared valueで管理（0～1の範囲）
  const animationValue = useSharedValue(0);

  // reanimatedのinterpolateを利用してpadding値を導出
  const animatedPadding = useDerivedValue(() => {
    return interpolate(
      animationValue.value,
      [0, 1],
      [hasHomeBar ? 20 : 0, keyboardHeight.value],
    );
  });
  const animatedStyle = useAnimatedStyle(() => {
    return {paddingBottom: animatedPadding.value};
  });
  const addPaddingAnimation = useCallback(
    (duration: number) => {
      animationValue.value = withTiming(1, {duration});
    },
    [animationValue],
  );

  const reducePaddingAnimation = useCallback(
    (duration: number) => {
      animationValue.value = withTiming(0, {duration});
    },
    [animationValue],
  );

  useEffect(() => {
    const showSubscription = KeyboardEvents.addListener(
      'keyboardWillShow',
      (event: KeyboardEventData) => {
        keyboardHeight.value = event.height;
        addPaddingAnimation(event.duration ?? 200);
      },
    );
    const showSubscription2 = KeyboardEvents.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      },
    );

    const hideSubscription = KeyboardEvents.addListener(
      'keyboardWillHide',
      (event: KeyboardEventData) => {
        keyboardHeight.value = 0;
        reducePaddingAnimation(event.duration ?? 200);
      },
    );

    const hideSubscription2 = KeyboardEvents.addListener(
      'keyboardDidHide',
      () => {
        // モーダルの✕ボタンを押したときはhideSubscriptionが呼ばれないため、ここで値をリセット
        keyboardHeight.value = 0;
        setIsKeyboardVisible(false);
      },
    );
    return () => {
      showSubscription.remove();
      showSubscription2.remove();
      hideSubscription.remove();
      hideSubscription2.remove();
    };
  }, [addPaddingAnimation, reducePaddingAnimation, keyboardHeight]);

  return {isKeyboardVisible, animatedStyle, animatedPadding};
};

export default useKeyboardAvoid;

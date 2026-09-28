import {useState, useCallback, useContext, useEffect} from 'react';
import {useWindowDimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import type {ModalHeaderRightButton} from '../parts/halfModalHeader';
import HalfModalHeader, {modalHeaderRight} from '../parts/halfModalHeader';
import type {ButtonStateType} from '../hooks/useButtonContext';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';
import useKeyboardAvoid from '../hooks/useKeyboardAnimation';
import Spacer from '../parts/spacer';

export type ModalLikeViewProps = {
  readonly id: string;
  readonly children?: ReactNode;
  readonly hasHeader: boolean;
  readonly style?: string;
  readonly onPressOutRightButton?: () => void;
  readonly onPressOutCrossButton?: () => void;
  readonly rightButtonStates?: ButtonStateType;
  readonly rightButtonColor?: string;
  readonly modalHeaderRightButton?: ModalHeaderRightButton;
  readonly isInReactNativeModal?: boolean; // ReactNavigation内にある場合はfalse
};

const ModalLikeView = (props: ModalLikeViewProps) => {
  const {
    activeModalLikeView,
    hideModalLikeView,
    setIsModalLikeViewHideAnimated,
    isModalLikeViewHideAnimated,
    setIsModalLikeViewShowAnimated,
    isModalLikeViewShowAnimated,
    hidedModalProcess,
  } = useContext(ModalLikeViewManagerContext);
  const {height} = useWindowDimensions();
  const {animatedStyle} = useKeyboardAvoid();

  const [modalLikeViewHeight, setModalLikeViewHeight] = useState<number>(2000);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [backdropDisplay, setBackdropDisplay] = useState<'flex' | 'hidden'>(
    'hidden',
  );

  const animatedValue = useSharedValue(0);

  const bottomAnimatedStyle = useAnimatedStyle(() => {
    return {
      bottom: interpolate(
        animatedValue.value,
        [0, 1],
        [-modalLikeViewHeight, 0],
      ),
    };
  });

  const backdropOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(animatedValue.value, [0, 1], [0, 0.3]),
    };
  });

  const showModalLikeViewAnimation = useCallback(() => {
    if (isVisible) return;
    setIsModalLikeViewShowAnimated(() => true);
    setBackdropDisplay('flex');
    setIsVisible(true);
    animatedValue.value = withTiming(1, {duration: 200}, (finished) => {
      if (finished) {
        runOnJS(setIsModalLikeViewShowAnimated)(false);
      }
    });
  }, [animatedValue, isVisible, setIsModalLikeViewShowAnimated]);

  const hideModalLikeViewAnimation = useCallback(() => {
    if (!isVisible) return;
    setIsVisible(false);
    animatedValue.value = withTiming(0, {duration: 200}, (finished) => {
      if (finished) {
        runOnJS(hidedModalProcess)();
      }
    });

    setIsModalLikeViewHideAnimated(() => true);
    setBackdropDisplay('hidden');
  }, [
    animatedValue,
    hidedModalProcess,
    isVisible,
    setIsModalLikeViewHideAnimated,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isModalLikeViewHideAnimated) return;
    if (isModalLikeViewShowAnimated) return;
    if (isVisible && activeModalLikeView === null) {
      setBackdropDisplay('hidden');
      hideModalLikeViewAnimation();
    } else if (!isVisible && activeModalLikeView === props.id) {
      setBackdropDisplay('flex');
      showModalLikeViewAnimation();
    }
  }, [activeModalLikeView]);

  return (
    <>
      {/* 背景 */}
      <Animated.View
        style={[
          tw.style(`z-10 absolute -top-12 w-full h-full bg-black rounded-t-xl`),
          backdropOpacityStyle,
          {pointerEvents: backdropDisplay === 'hidden' ? 'none' : 'auto'},
        ]}
      />
      {/* モーダル本体 */}
      <Animated.View
        style={[tw.style(`w-full z-30 absolute`), bottomAnimatedStyle]}
        onLayout={(event) => {
          setModalLikeViewHeight(event.nativeEvent.layout.height);
        }}
      >
        {props.hasHeader ? (
          <HalfModalHeader
            rightButtonColor={props.rightButtonColor}
            rightButtonStates={props.rightButtonStates}
            rightButtonType={
              props.modalHeaderRightButton ?? modalHeaderRight.none
            }
            onPressOutCrossButton={() => {
              if (props.onPressOutCrossButton) {
                props.onPressOutCrossButton();
              } else {
                hideModalLikeView();
              }
            }}
            onPressOutRightButton={() => {
              if (props.onPressOutRightButton) {
                props.onPressOutRightButton();
              }
            }}
          />
        ) : null}
        <Animated.View
          style={[
            tw.style(
              // bottomにあるためpaddingBottomは効かない。代わりにspacerを使う
              `bg-white items-center max-h-[${height - 100}px] `,

              props.style ?? `px-10`,
              !props.hasHeader && 'rounded-t-xl pt-5',
            ),
            animatedStyle,
          ]}
        >
          {isVisible && props.children}
          {props.isInReactNativeModal && (
            <Spacer isHorizontal={false} size={16} />
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
};

export default ModalLikeView;

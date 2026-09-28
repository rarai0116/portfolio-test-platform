import {Platform, useWindowDimensions, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useState, useContext, useEffect, type ReactNode} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Modal from 'react-native-modal';
import tw from '../../tailwind.custom';
import HalfModalHeader, {
  type ModalHeaderRightButton,
} from '../parts/halfModalHeader';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import type {ButtonStateType} from '../hooks/useButtonContext';
import useKeyboardAvoid from '../hooks/useKeyboardAnimation';
import Spacer from '../parts/spacer';

export type HalfModalProps = {
  readonly id: string;
  readonly children: ReactNode;
  readonly hasHeader: boolean;
  readonly isBackDropPressFreeze?: boolean;
  readonly modalHeaderRightButton: ModalHeaderRightButton;
  readonly backDropPress?: () => void;
  readonly style?: string;
  readonly onPressOutRightButton?: () => void;
  readonly onPressOutCrossButton?: () => void;
  readonly rightButtonStates?: ButtonStateType;
  readonly rightButtonColor?: string;
};

const HalfModal = (props: HalfModalProps) => {
  const {height} = useWindowDimensions();
  const {animatedStyle} = useKeyboardAvoid();
  const {activeModal, hideModal, isModalHideAnimated, setIsModalHideAnimated} =
    useContext(ModalManagerContext);
  // const [isVisible, setIsVisible] = useState<boolean>(false);
  const [modalHeight, setModalHeight] = useState<number>(0); // モーダルの高さを管理する状態
  const [headerModalHeight, setHeaderModalHeight] = useState<number>(0); // ヘッダーの高さを管理する状態
  // const [isVisible, setIsVisible] = useState<boolean>(false);

  /*
  useEffect(() => {
    // console.log('HalfModal', props.id, activeModal);
    if (activeModal === props.id) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [activeModal, props.id]);
  */
  /*
  useEffect(() => {
    console.log(
      'HalfModal',
      props.id,
      height - modalHeight - headerModalHeight,
      headerModalHeight,
      modalHeight,
      height,
    );
  }, [modalHeight, headerModalHeight, height, props.id]);
  */

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    return () => {
      // クリーンアップ関数でモーダルが非表示になったときに実行される

      if (isModalHideAnimated) {
        setIsModalHideAnimated(false);
      }
    };
  }, [activeModal, props.id, isModalHideAnimated]);

  return (
    <Modal
      statusBarTranslucent
      hideModalContentWhileAnimating
      isVisible={activeModal === props.id && !isModalHideAnimated}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropColor="#000000"
      backdropOpacity={0.3}
      animationInTiming={300}
      animationOutTiming={500}
      style={tw.style(
        `m-0 flex justify-end pt-[${height - modalHeight - headerModalHeight}px]`,
      )}
      onBackdropPress={() => {
        if (props.isBackDropPressFreeze) return;
        if (props.backDropPress) {
          props.backDropPress();
        }

        hideModal();
      }}
      onModalHide={() => {
        if (isModalHideAnimated) setIsModalHideAnimated(false);
      }}
    >
      <GestureHandlerRootView>
        <View>
          {props.hasHeader ? (
            <View
              /*
              onPressOut={() => {
                // react-native-modal内のAppTextInputでonBlurが効かないためPressableで要素を囲う
                console.log('onPressOut dismiss2');
                Keyboard.dismiss();
              }}
              */
              onLayout={(event) => {
                setHeaderModalHeight(event.nativeEvent.layout.height);
              }}
            >
              <HalfModalHeader
                rightButtonColor={props.rightButtonColor}
                rightButtonStates={props.rightButtonStates}
                rightButtonType={props.modalHeaderRightButton}
                onPressOutCrossButton={() => {
                  if (props.onPressOutCrossButton) {
                    props.onPressOutCrossButton();
                  } else {
                    hideModal();
                  }
                }}
                onPressOutRightButton={() => {
                  if (props.onPressOutRightButton) {
                    props.onPressOutRightButton();
                  }
                }}
              />
            </View>
          ) : null}
          <View
            key={`halfModal-body-${props.id}`}
            style={tw.style(
              `bg-white items-center max-h-[${height - 100}px] min-h-[30px]`,
              // 0より大きいサイズにならないとレンダリング自体が行われない場合があるため
              Platform.OS === 'ios' ? `` : `pb-6`,
              props.style ? `${props.style}` : `px-10`,
              !props.hasHeader && 'rounded-t-xl pt-5',
            )}
            onLayout={(event) => {
              // console.log('onLayout', event.nativeEvent.layout.height);
              const newHeight = event.nativeEvent.layout.height;
              if (Math.abs(newHeight - modalHeight) > 1) {
                // 1px以上の差があれば更新
                // console.log('onLayout', newHeight);
                setModalHeight(newHeight);
              }
            }}
            /*
            onPressOut={() => {
              console.log('onPressOut dismiss');
              Keyboard.dismiss();
            }}
              */
          >
            {props.children}
            <Animated.View style={animatedStyle} />
            {Platform.OS === 'ios' && <Spacer isHorizontal={false} size={16} />}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default HalfModal;

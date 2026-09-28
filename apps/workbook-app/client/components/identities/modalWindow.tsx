import type {ReactNode} from 'react';
import {useContext} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Modal from 'react-native-modal';
import tw from '../../tailwind.custom';
import {ModalManagerContext} from '../hooks/useModalManagerContext';

export type ModalWindowProps = {
  readonly id: string;
  readonly children: ReactNode;
  readonly isBackDropPressFreeze?: boolean;
  readonly backDropPress?: () => void;
};

const ModalWindow = (props: ModalWindowProps) => {
  const {activeModal, hideModal, setIsModalHideAnimated} =
    useContext(ModalManagerContext);
  return (
    <Modal
      animationIn="fadeIn"
      animationOut="fadeOut"
      isVisible={activeModal === props.id}
      backdropColor="#000000"
      backdropOpacity={0.3}
      style={tw``}
      onBackdropPress={() => {
        if (props.isBackDropPressFreeze) return;
        if (props.backDropPress) {
          props.backDropPress();
        }

        hideModal();
      }}
      onModalHide={() => {
        setIsModalHideAnimated(false);
      }}
    >
      <GestureHandlerRootView
        style={tw.style(`bg-white items-center px-10 pt-5 pb-4 rounded-xl`)}
      >
        {props.children}
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ModalWindow;

import {useState, useContext, useEffect} from 'react';
import {Platform, View} from 'react-native';
import HalfModal from '../identities/halfModal';
import InquiryFormModal from '../organisms/inquiryFormModal';
import {modalHeaderRight} from '../parts/halfModalHeader';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import type {ButtonStateType} from '../hooks/useButtonContext';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import {inquiryFormModalStates} from '../../types/commonUnionType';
import PrimaryShortButton from '../parts/primaryShortButton';
import Spacer from '../parts/spacer';
import {InquiryFormContext} from '../hooks/useInquiryFormContextProvider';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';
import tw from '../../tailwind.custom';
import FormAskCloseModal from '../organisms/formAskCloseModal';

export type InquiryFormViewModalProps = Record<string, never>;

const InquiryFormViewModal = (_props: InquiryFormViewModalProps) => {
  const {activeModal, showModal, hideModal} = useContext(ModalManagerContext);
  const {showModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {textValue, setTextValue, textLength, setTextLength} =
    useContext(TextInputContext);
  const {isInitialOpen, setIsInitialOpen} = useContext(InquiryFormContext);
  const [footerButtonState, setFooterButtonState] = useState<ButtonStateType>(
    ButtonStates.disabled,
  );

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isInitialOpen) {
      setTextValue(undefined);
      setTextLength(0);
    }
  }, [isInitialOpen, activeModal]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (textValue?.trim().length) {
      setFooterButtonState(ButtonStates.released);
    } else {
      setFooterButtonState(ButtonStates.disabled);
    }
  }, [textLength, textValue]);

  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={inquiryFormModalStates.inquiryFormViewModal}
      modalHeaderRightButton={modalHeaderRight.none}
      style="px-0" // paddingがあるとFormAskCloseModalのバックドロップが綺麗に表示されない
      onPressOutCrossButton={() => {
        if (textValue?.trim().length) {
          showModalLikeView(inquiryFormModalStates.askClose);
        } else {
          hideModal();
        }
      }}
    >
      <InquiryFormModal />
      <FormAskCloseModal id={inquiryFormModalStates.askClose} />
      <Spacer isHorizontal={false} size={20} />
      <ButtonContextProvider
        state={footerButtonState}
        onPressOut={() => {
          if (activeModal !== inquiryFormModalStates.inquiryFormViewModal)
            return;
          setIsInitialOpen(false);
          showModal(inquiryFormModalStates.askSubmit);
        }}
      >
        <View style={tw`w-full items-center justify-center`}>
          <PrimaryShortButton text="確認" />
        </View>
      </ButtonContextProvider>
      {Platform.OS === 'ios' && <Spacer isHorizontal={false} size={20} />}
    </HalfModal>
  );
};

export default InquiryFormViewModal;

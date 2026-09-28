import {useState, useContext, useEffect} from 'react';
import {Platform, View} from 'react-native';
import HalfModal from '../../identities/halfModal';
import {modalHeaderRight} from '../../parts/halfModalHeader';
import {TextInputContext} from '../../hooks/useTextInputContextProvider';
import {ModalManagerContext} from '../../hooks/useModalManagerContext';
import type {ButtonStateType} from '../../hooks/useButtonContext';
import {
  ButtonContextProvider,
  ButtonStates,
} from '../../hooks/useButtonContext';
import {errorReportFormModalStates} from '../../../types/commonUnionType';
import PrimaryShortButton from '../../parts/primaryShortButton';
import Spacer from '../../parts/spacer';
import FormAskCloseModal from '../../organisms/formAskCloseModal';
import {ModalLikeViewManagerContext} from '../../hooks/useModalLikeViewManagerContext';
import tw from '../../../tailwind.custom';
import ErrorReportForm from './organisms/errorReportForm';
import {ErrorReporfFormContext} from './hooks/useErrorReporfFormContext';

export type ErrorReportFormViewModalProps = Record<string, never>;

const ErrorReportFormViewModal = (_props: ErrorReportFormViewModalProps) => {
  const {activeModal, showModal, hideModal} = useContext(ModalManagerContext);
  const {showModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {textValue, setTextValue, textLength, setTextLength} =
    useContext(TextInputContext);
  const {
    isInitialOpen,
    setIsInitialOpen,
    errorCheckedButtonInfoList,
    setErrorCheckedButtonInfoList,
  } = useContext(ErrorReporfFormContext);
  const [footerButtonState, setFooterButtonState] = useState<ButtonStateType>(
    ButtonStates.disabled,
  );

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isInitialOpen) {
      setTextValue(undefined);
      setTextLength(0);
      setErrorCheckedButtonInfoList([]);
    }
  }, [isInitialOpen, activeModal]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (errorCheckedButtonInfoList.length > 0 || textValue?.trim().length) {
      setFooterButtonState(ButtonStates.released);
    } else {
      setFooterButtonState(ButtonStates.disabled);
    }
  }, [textLength, textValue, errorCheckedButtonInfoList]);

  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={errorReportFormModalStates.viewModal}
      modalHeaderRightButton={modalHeaderRight.none}
      style="px-0"
      onPressOutCrossButton={() => {
        if (errorCheckedButtonInfoList.length > 0 || textValue?.trim().length) {
          showModalLikeView(errorReportFormModalStates.askClose);
        } else {
          hideModal();
        }
      }}
    >
      <ErrorReportForm />
      <FormAskCloseModal id={errorReportFormModalStates.askClose} />
      <Spacer isHorizontal={false} size={20} />
      <ButtonContextProvider
        state={footerButtonState}
        onPressOut={() => {
          if (activeModal !== errorReportFormModalStates.viewModal) return;
          setIsInitialOpen(false);
          showModal(errorReportFormModalStates.askSubmit);
        }}
      >
        <View style={tw`w-full items-center justify-center`}>
          <PrimaryShortButton text="報告" />
        </View>
      </ButtonContextProvider>
      {Platform.OS === 'ios' && <Spacer isHorizontal={false} size={16} />}
    </HalfModal>
  );
};

export default ErrorReportFormViewModal;

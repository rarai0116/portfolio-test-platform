import {useContext} from 'react';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import BasicHalfModal from '../parts/basicHalfModal';
import {inquiryFormModalStates} from '../../types/commonUnionType';

export type InquiryFormSubmitCompletedModalProps = Record<string, never>;

const InquiryFormSubmitCompletedModal = (
  _props: InquiryFormSubmitCompletedModalProps,
) => {
  const {hideModal} = useContext(ModalManagerContext);

  return (
    <BasicHalfModal
      title="ご意見・ご報告ありがとうございました"
      id={inquiryFormModalStates.submitCompleted}
      basicHalfModalInputId={`input_${inquiryFormModalStates.submitCompleted}`}
      hasInput={false}
      thirdlyButtonText="OK"
      onPressOutThirdlyButton={() => {
        hideModal();
      }}
    />
  );
};

export default InquiryFormSubmitCompletedModal;

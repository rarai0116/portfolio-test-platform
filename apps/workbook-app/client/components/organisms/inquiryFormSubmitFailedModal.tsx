import {useContext} from 'react';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import BasicHalfModal from '../parts/basicHalfModal';
import {inquiryFormModalStates} from '../../types/commonUnionType';

export type InquiryFormSubmitFailedModalProps = Record<string, never>;

const InquiryFormSubmitFailedModal = (
  _props: InquiryFormSubmitFailedModalProps,
) => {
  const {showModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      isBackDropPressFreeze
      title="送信に失敗しました"
      id={inquiryFormModalStates.submitFailed}
      basicHalfModalInputId={`input_${inquiryFormModalStates.submitFailed}`}
      hasInput={false}
      primaryButtonText="再送信"
      thirdlyButtonText="キャンセル"
      onPressOutPrimaryButton={() => {
        showModal(inquiryFormModalStates.submitCompleted);
      }}
      onPressOutThirdlyButton={() => {
        showModal(inquiryFormModalStates.inquiryFormViewModal);
      }}
    />
  );
};

export default InquiryFormSubmitFailedModal;

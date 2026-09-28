import {useContext} from 'react';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';
import BasicHalfModal from '@/components/parts/basicHalfModal';
import {errorReportFormModalStates} from '@/types/commonUnionType';

export type ErrorReportFormSubmitFailedModalProps = Record<string, never>;

const ErrorReportFormSubmitFailedModal = (
  _props: ErrorReportFormSubmitFailedModalProps,
) => {
  const {showModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      isBackDropPressFreeze
      title="送信に失敗しました"
      id={errorReportFormModalStates.submitFailed}
      basicHalfModalInputId={`input_${errorReportFormModalStates.submitFailed}`}
      hasInput={false}
      primaryButtonText="再送信"
      thirdlyButtonText="キャンセル"
      onPressOutPrimaryButton={() => {
        showModal(errorReportFormModalStates.submitCompleted);
      }}
      onPressOutThirdlyButton={() => {
        showModal(errorReportFormModalStates.viewModal);
      }}
    />
  );
};

export default ErrorReportFormSubmitFailedModal;

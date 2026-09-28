import {useContext} from 'react';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';
import BasicHalfModal from '@/components/parts/basicHalfModal';
import {errorReportFormModalStates} from '@/types/commonUnionType';

export type ErrorReportFormSubmitCompletedModalProps = Record<string, never>;

const ErrorReportFormSubmitCompletedModal = (
  _props: ErrorReportFormSubmitCompletedModalProps,
) => {
  const {hideModal} = useContext(ModalManagerContext);

  return (
    <BasicHalfModal
      title="ご報告ありがとうございました"
      id={errorReportFormModalStates.submitCompleted}
      hasInput={false}
      thirdlyButtonText="OK"
      onPressOutThirdlyButton={() => {
        hideModal();
      }}
    />
  );
};

export default ErrorReportFormSubmitCompletedModal;

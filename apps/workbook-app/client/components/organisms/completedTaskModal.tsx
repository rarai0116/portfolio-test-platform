import {useContext} from 'react';
import {settingCardModalStates} from '../../types/commonUnionType';
import BasicHalfModal from '../parts/basicHalfModal';
import {ModalManagerContext} from '../hooks/useModalManagerContext';

export type CompletedTaskModalProps = Record<string, never>;

const CompletedTaskModal = (_props: CompletedTaskModalProps) => {
  const {hideModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      title="完了した課題です"
      id={settingCardModalStates.completedTaskModal}
      basicHalfModalInputId={`input_${settingCardModalStates.completedTaskModal}`}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={hideModal}
    />
  );
};

export default CompletedTaskModal;

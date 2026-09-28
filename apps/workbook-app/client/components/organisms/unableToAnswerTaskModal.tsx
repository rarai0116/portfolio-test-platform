import {useContext} from 'react';
import {settingCardModalStates} from '../../types/commonUnionType';
import BasicHalfModal from '../parts/basicHalfModal';
import {ModalManagerContext} from '../hooks/useModalManagerContext';

export type UnableToAnswerTaskModalProps = Record<string, never>;

const UnableToAnswerTaskModal = (_props: UnableToAnswerTaskModalProps) => {
  const {hideModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      title="提出できません"
      id={settingCardModalStates.unableToAnswerModal}
      basicHalfModalInputId={`input_${settingCardModalStates.unableToAnswerModal}`}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={hideModal}
    />
  );
};

export default UnableToAnswerTaskModal;

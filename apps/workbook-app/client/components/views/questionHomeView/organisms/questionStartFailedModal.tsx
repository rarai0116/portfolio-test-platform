import {useContext} from 'react';
import {questionHomeViewModalStates} from '../../../../types/commonUnionType';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';
import BasicHalfModal from '../../../parts/basicHalfModal';

export type QuestionStartFailedModalProps = Record<string, never>;

/** [Deprecated] テスト開始に失敗した場合に表示するモーダル */
const QuestionStartFailedModal = (_props: QuestionStartFailedModalProps) => {
  const {hideModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      id={questionHomeViewModalStates.QuestionStartFailed}
      hasInput={false}
      title="テストの開始が何らかの原因で失敗しました"
      thirdlyButtonText="閉じる"
      modalStyle="bg-background"
      onPressOutThirdlyButton={() => {
        hideModal();
      }}
    />
  );
};

export default QuestionStartFailedModal;

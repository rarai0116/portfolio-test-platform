import {useContext} from 'react';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';

export type FormAskCloseModalProps = {
  readonly id: string;
};

const FormAskCloseModal = (props: FormAskCloseModalProps) => {
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {hideModal} = useContext(ModalManagerContext);

  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="このまま画面を閉じると、入力した内容が失われますがよろしいですか？"
      id={props.id}
      hasInput={false}
      primaryButtonText="閉じる"
      thirdlyButtonText="キャンセル"
      basicHalfModalInputId=""
      onPressOutPrimaryButton={() => {
        hideModalLikeView();
        hideModal();
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default FormAskCloseModal;

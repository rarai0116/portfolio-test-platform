import {useContext} from 'react';
import {questionSettingModalStates} from '../../types/commonUnionType';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';

export type QuestionSettingSaveAsNewCompletedModalProps = Record<string, never>;

/** 名前をつけて保存完了モーダル */
const QuestionSettingSaveAsNewCompletedModal = (
  _props: QuestionSettingSaveAsNewCompletedModalProps,
) => {
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {textValue} = useContext(TextInputContext);

  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="保存しました"
      text={`設定した名前:${textValue}`}
      id={questionSettingModalStates.saveAsNewCompleted}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default QuestionSettingSaveAsNewCompletedModal;

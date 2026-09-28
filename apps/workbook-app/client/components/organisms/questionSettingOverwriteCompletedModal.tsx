import {useContext} from 'react';
import {questionSettingModalStates} from '../../types/commonUnionType';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';

export type QuestionSettingOverwriteCompletedModalProps = Record<string, never>;

/** 上書き保存完了モーダル */
const QuestionSettingOverwriteCompletedModal = (
  _props: QuestionSettingOverwriteCompletedModalProps,
) => {
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="上書き保存しました"
      /* text= `元からの名前` */
      id={questionSettingModalStates.overwriteCompleted}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={hideModalLikeView}
    />
  );
};

export default QuestionSettingOverwriteCompletedModal;

import {useContext} from 'react';
import {questionSettingModalStates} from '../../types/commonUnionType';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';

export type QuestionSettingAskInitialSaveSettingModalProps = Record<
  string,
  never
>;

/** 初回保存時のモーダル */
const QuestionSettingAskInitialSaveSettingModal = (
  _props: QuestionSettingAskInitialSaveSettingModalProps,
) => {
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="設定を保存しますか？"
      id={questionSettingModalStates.askInitialSaveSetting}
      primaryButtonText="名前をつけて保存"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      onPressOutPrimaryButton={() => {
        console.log('名前をつけて保存');
        // hideModalLikeView();
        showModalLikeView(questionSettingModalStates.saveAsNewTextInput);
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default QuestionSettingAskInitialSaveSettingModal;

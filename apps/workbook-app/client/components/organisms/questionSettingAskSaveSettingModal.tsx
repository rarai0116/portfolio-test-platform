import {useContext} from 'react';
import {questionSettingModalStates} from '../../types/commonUnionType';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';

export type QuestionSettingAskSaveSettingModalProps = Record<string, never>;

/** 保存形式選択モーダル */
const QuestionSettingAskSaveSettingModal = (
  _props: QuestionSettingAskSaveSettingModalProps,
) => {
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="設定を保存しますか？"
      text="条件が変更されています"
      id={questionSettingModalStates.askSaveSetting}
      primaryButtonText="上書き保存"
      secondaryButtonText="名前をつけて保存"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      onPressOutPrimaryButton={() => {
        console.log('上書き保存');
        // hideModalLikeView();
        showModalLikeView(questionSettingModalStates.overwriteCompleted);
      }}
      onPressOutSecondaryButton={() => {
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

export default QuestionSettingAskSaveSettingModal;

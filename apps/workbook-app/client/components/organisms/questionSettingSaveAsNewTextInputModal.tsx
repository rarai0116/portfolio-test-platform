import {useMemo, useContext} from 'react';
import {
  questionSettingModalStates,
  questionSettingState,
} from '../../types/commonUnionType';
import {
  getTodayTimestamp,
  getYmdDayTimeString,
} from '../functionals/timeManager';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import BasicModalLikeView from '../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../hooks/useModalLikeViewManagerContext';
import {ButtonStates} from '../hooks/useButtonContext';

export type QuestionSettingSaveAsNewTextInputModalProps = Record<string, never>;

/** 名前入力モーダル */
const QuestionSettingSaveAsNewTextInputModal = (
  _props: QuestionSettingSaveAsNewTextInputModalProps,
) => {
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  const {textValue} = useContext(TextInputContext);

  const {settingState, questionModeType, writeSavedQuestionSetting} =
    useContext(QuestionSettingViewContext);
  // 日付を取得
  const now = useMemo(() => getTodayTimestamp(), []);
  const defaultFileName = useMemo(() => getYmdDayTimeString(now), [now]);

  return (
    <BasicModalLikeView
      isInReactNativeModal
      hasInput
      inputDefaultValue={defaultFileName}
      title="名前を入力してください"
      id={questionSettingModalStates.saveAsNewTextInput}
      primaryButtonText="保存"
      thirdlyButtonText="キャンセル"
      primaryButtonState={
        textValue?.trim().length ? ButtonStates.released : ButtonStates.disabled
      }
      onPressOutPrimaryButton={async () => {
        if (!textValue?.trim().length) return;

        // hideModalLikeView();
        showModalLikeView(questionSettingModalStates.saveAsNewCompleted);
        writeSavedQuestionSetting(textValue, questionModeType);
      }}
      onPressOutThirdlyButton={() => {
        // hideModalLikeView();
        if (
          settingState === questionSettingState.saved ||
          settingState === questionSettingState.previous
        ) {
          showModalLikeView(questionSettingModalStates.askSaveSetting);
        } else {
          hideModalLikeView();
        }
      }}
    />
  );
};

export default QuestionSettingSaveAsNewTextInputModal;

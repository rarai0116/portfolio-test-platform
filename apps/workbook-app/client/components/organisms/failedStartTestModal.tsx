import {useContext} from 'react';
import {ModalManagerContext} from '@hooks/useModalManagerContext';
import BasicHalfModal from '@parts/basicHalfModal';
import {QuestionSettingViewContext} from '@hooks/useQuestionSettingViewContext';
import {questionSettingModalStates} from '@/types/commonUnionType';
/** 条件に合う問題が1問以上設定問題数未満の場合に表示するモーダル */
type NotEnoughQuestionSettingConditionModalProps = {
  readonly onPressOutOkButton: () => void;
  // readonly onPressOutChangeConditionButton: () => void;
  readonly onPressOutCancelButton: () => void;
};
export const NotEnoughQuestionSettingConditionModal = (
  props: NotEnoughQuestionSettingConditionModalProps,
) => {
  const {hideModal} = useContext(ModalManagerContext);
  const {
    requiredQuestionCount,
    qualifiedQuestionCount,
    questionNumberOfQuestionsInfo,
    setIsPracticeQuestionStartReserved,
  } = useContext(QuestionSettingViewContext);
  return (
    <BasicHalfModal
      title="条件に合う問題数が、指定の問題数に足りませんでした"
      text={`条件に合う問題数:${qualifiedQuestionCount}\n指定の問題数:${requiredQuestionCount}\n${qualifiedQuestionCount}問で演習を開始しますか？`}
      id={questionSettingModalStates.notEnoughQuestionSettingCondition}
      primaryButtonText="OK"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      onPressOutPrimaryButton={() => {
        hideModal(() => {
          questionNumberOfQuestionsInfo.setSelectedValue([
            String(qualifiedQuestionCount),
          ]);
          setIsPracticeQuestionStartReserved(true);
          props.onPressOutOkButton();
        });
      }}
      onPressOutThirdlyButton={() => {
        hideModal(props.onPressOutCancelButton);
      }}
    />
  );
};

/** 条件に合う問題が一問もない場合に表示するモーダル */
type NoQuestionSettingConditionModalProps = {
  // readonly onPressOutChangeConditionButton: () => void;
  readonly onPressOutOkButton: () => void;
};
export const NoQuestionSettingConditionModal = (
  props: NoQuestionSettingConditionModalProps,
) => {
  const {hideModal} = useContext(ModalManagerContext);
  const {requiredQuestionCount} = useContext(QuestionSettingViewContext);

  return (
    <BasicHalfModal
      title="条件に合う問題がありませんでした"
      text={`指定の問題数:${requiredQuestionCount}`}
      id={questionSettingModalStates.noQuestionSettingCondition}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={() => {
        hideModal(props.onPressOutOkButton);
      }}
    />
  );
};

export type QuestionStartFailedModalProps = {
  /** テストの開始が何らかの原因で失敗した場合に表示するモーダル */
  readonly onPressOutCloseButton: () => void;
  // readonly onPressOutChangeConditionButton: () => void;
  // readonly onPressOutCancelButton: () => void;
};
/** テストの開始が何らかの原因で失敗した場合に表示するモーダル */
export const QuestionStartFailedModal = (
  props: QuestionStartFailedModalProps,
) => {
  const {hideModal} = useContext(ModalManagerContext);
  return (
    <BasicHalfModal
      id={questionSettingModalStates.QuestionStartFailed}
      hasInput={false}
      title="テストの開始が何らかの原因で失敗しました"
      thirdlyButtonText="閉じる"
      modalStyle="bg-background"
      onPressOutThirdlyButton={() => {
        hideModal(props.onPressOutCloseButton);
      }}
    />
  );
};

type FailedStartTestModalsProps = {
  readonly noQuestionSettingConditionModalProps: NoQuestionSettingConditionModalProps;
  readonly notEnoughQuestionSettingConditionModalProps: NotEnoughQuestionSettingConditionModalProps;
  readonly questionStartFailedModalProps: QuestionStartFailedModalProps;
};
const FailedStartTestModals = (props: FailedStartTestModalsProps) => {
  return (
    <>
      <NoQuestionSettingConditionModal
        onPressOutOkButton={
          props.noQuestionSettingConditionModalProps?.onPressOutOkButton
        }
      />
      <NotEnoughQuestionSettingConditionModal
        onPressOutOkButton={
          props.notEnoughQuestionSettingConditionModalProps.onPressOutOkButton
        }
        onPressOutCancelButton={
          props.notEnoughQuestionSettingConditionModalProps
            .onPressOutCancelButton
        }
      />
      <QuestionStartFailedModal
        onPressOutCloseButton={
          props.questionStartFailedModalProps.onPressOutCloseButton
        }
      />
    </>
  );
};

export default FailedStartTestModals;

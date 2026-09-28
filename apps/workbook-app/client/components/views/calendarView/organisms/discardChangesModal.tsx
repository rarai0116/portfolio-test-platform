import {useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import type {RootViewsProps} from '../../../../types/viewParameter';

export type DiscardChangesModalProps = Record<string, never>;

const DiscardChangesModal = (_props: DiscardChangesModalProps) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {setIsInCalendarTaskSetting} = useContext(QuestionSettingViewContext);

  return (
    <BasicModalLikeView
      title="編集内容を破棄してよろしいですか"
      id={calendarTaskSettingModalStates.discardChanges}
      primaryButtonText="はい"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutPrimaryButton={() => {
        setIsInCalendarTaskSetting(false);
        navigation.goBack();
        hideModalLikeView();
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default DiscardChangesModal;

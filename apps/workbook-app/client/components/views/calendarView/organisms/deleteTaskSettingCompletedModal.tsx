import {useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import type {RootViewsProps} from '../../../../types/viewParameter';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';

export type DeleteTaskSettingCompletedModalProps = Record<string, never>;

const DeleteTaskSettingCompletedModal = (
  _props: DeleteTaskSettingCompletedModalProps,
) => {
  const _navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {setIsInCalendarTaskSetting} = useContext(QuestionSettingViewContext);
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);

  return (
    <BasicModalLikeView
      isInReactNativeModal
      title="削除しました"
      id={calendarTaskSettingModalStates.deleteCompleted}
      thirdlyButtonText="OK"
      hasInput={false}
      onPressOutThirdlyButton={() => {
        setIsInCalendarTaskSetting(false);
        hideModalLikeView();
        // navigation.goBack();
      }}
    />
  );
};

export default DeleteTaskSettingCompletedModal;

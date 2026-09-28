import {useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import type {RootViewsProps} from '../../../../types/viewParameter';
import {GlobalSaveDataContext} from '../../../hooks/useGlobalSaveDataContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';

export type AskDeleteTaskSettingModalProps = Record<string, never>;

const AskDeleteTaskSettingModal = (_props: AskDeleteTaskSettingModalProps) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {setIsInCalendarTaskSetting: _setIsInCalendarTaskSetting} = useContext(
    QuestionSettingViewContext,
  );
  const {removeTargetSavedSettingList} = useContext(GlobalSaveDataContext);
  const {currentTaskSettingCardId} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  return (
    <BasicModalLikeView
      title="課題を破棄してもよろしいですか"
      id={calendarTaskSettingModalStates.askDelete}
      primaryButtonText="はい"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutPrimaryButton={async () => {
        if (currentTaskSettingCardId === undefined)
          throw new Error('currentTaskSettingCardId is null');
        // setTargetSavedSettingId(currentTaskSettingCardId);
        hideModalLikeView(async () => {
          await removeTargetSavedSettingList();
          navigation.goBack();
        });

        // showModalLikeView(calendarTaskSettingModalStates.deleteCompleted);
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default AskDeleteTaskSettingModal;

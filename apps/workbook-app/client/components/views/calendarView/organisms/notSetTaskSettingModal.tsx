import {useContext} from 'react';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';

export type NotSetTaskSettingModalProps = Record<string, never>;

const NotSetTaskSettingModal = (_props: NotSetTaskSettingModalProps) => {
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  const {saveTaskSetting, temporaryTaskSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const {setIsDisabledInput} = useContext(GlobalUserSettingContext);

  return (
    <BasicModalLikeView
      title="課題が設定されていませんがこのまま保存してよろしいですか"
      id={calendarTaskSettingModalStates.notSetTaskSetting}
      primaryButtonText="はい"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutPrimaryButton={async () => {
        if (!temporaryTaskSetting.title) return;
        if (!temporaryTaskSetting.taskSetting) return;
        setIsDisabledInput(true, async () => {
          await saveTaskSetting()
            .then(() => {
              showModalLikeView(calendarTaskSettingModalStates.saveCompleted);
            })
            .catch((error: unknown) => {
              console.error('Error saving task setting:', error);
              showModalLikeView(calendarTaskSettingModalStates.saveFailed);
            });
          setIsDisabledInput(false);
        });
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default NotSetTaskSettingModal;

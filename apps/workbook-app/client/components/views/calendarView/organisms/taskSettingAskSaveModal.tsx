import {useContext, useRef} from 'react';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';

export type TaskSettingAskSaveModalProps = Record<string, never>;

const TaskSettingAskSaveModal = (_props: TaskSettingAskSaveModalProps) => {
  const {showModalLikeView, hideModalLikeView} = useContext(
    ModalLikeViewManagerContext,
  );
  const {saveTaskSetting} = useContext(CalendarTaskSettingViewModalContext);
  const {setIsDisabledInput} = useContext(GlobalUserSettingContext);

  const saveRef = useRef<boolean>(false);

  return (
    <BasicModalLikeView
      title="設定を保存しますか？"
      id={calendarTaskSettingModalStates.askSaveSetting}
      primaryButtonText="保存"
      thirdlyButtonText="キャンセル"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutPrimaryButton={async () => {
        if (saveRef.current) return;
        saveRef.current = true;
        setIsDisabledInput(true, async () => {
          await saveTaskSetting()
            .then(() => {
              showModalLikeView(calendarTaskSettingModalStates.saveCompleted);
            })
            .catch((error: unknown) => {
              console.error('Error saving task setting:', error);
              showModalLikeView(calendarTaskSettingModalStates.saveFailed);
            });
          saveRef.current = false;
          setIsDisabledInput(false).catch((error: unknown) => {
            console.error('Error setting disabled input:', error);
          });
        }).catch((error: unknown) => {
          console.error('Error setting disabled input:', error);
        });
      }}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default TaskSettingAskSaveModal;

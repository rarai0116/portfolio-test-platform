import {useContext} from 'react';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';

export type TaskSettingSaveFailedModalProps = Record<string, never>;

const TaskSettingSaveFailedModal = (
  _props: TaskSettingSaveFailedModalProps,
) => {
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);

  return (
    <BasicModalLikeView
      title="保存に失敗しました"
      id={calendarTaskSettingModalStates.saveFailed}
      thirdlyButtonText="OK"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutThirdlyButton={() => {
        hideModalLikeView();
      }}
    />
  );
};

export default TaskSettingSaveFailedModal;

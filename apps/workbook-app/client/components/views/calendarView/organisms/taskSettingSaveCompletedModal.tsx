import {useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import BasicModalLikeView from '../../../parts/basicModalLikeView';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import type {RootViewsProps} from '../../../../types/viewParameter';
import {QuestionSettingViewContext} from '@/components/hooks/useQuestionSettingViewContext';

export type TaskSettingSaveCompletedModalProps = Record<string, never>;

const TaskSettingSaveCompletedModal = (
  _props: TaskSettingSaveCompletedModalProps,
) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {hideModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {setIsInCalendarTaskSetting} = useContext(QuestionSettingViewContext);

  return (
    <BasicModalLikeView
      title="保存しました"
      id={calendarTaskSettingModalStates.saveCompleted}
      thirdlyButtonText="OK"
      hasInput={false}
      isInReactNativeModal={false}
      onPressOutThirdlyButton={() => {
        setIsInCalendarTaskSetting(false);
        hideModalLikeView();
        navigation.goBack();
        /*
        navigation.navigate('Tab', {
          screen: 'CalenderTab',
          params: {
            screen: 'CalendarHome',
          },
        });
        navigation.goBack();
        */
      }}
    />
  );
};

export default TaskSettingSaveCompletedModal;

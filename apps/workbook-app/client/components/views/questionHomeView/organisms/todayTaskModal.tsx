import {useCallback, useContext} from 'react';
import {ScrollView, useWindowDimensions} from 'react-native';
import type {SettingCardData} from '@hooks/useGlobalSaveDataContext';
import {QuestionSettingViewContext} from '@hooks/useQuestionSettingViewContext';
import {
  questionHomeViewModalStates,
  taskSettingModalStates,
} from '../../../../types/commonUnionType';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';
import {displaySettingCardList} from '../../../parts/displaySettingCardList';
import {QuestionHomeViewContext} from '../hooks/useQuestionHomeViewContext';
import QuestionSettingViewModal from '../../../viewmodals/questionSettingViewModal';
import {CalendarTaskSettingViewModalContext} from '../../calendarView/hooks/useCalendarTaskSettingViewModalContext';
import HalfModal from '@/components/identities/halfModal';
import {modalHeaderRight} from '@/components/parts/halfModalHeader';
import tw from '@/tailwind.custom';
import Spacer from '@/components/parts/spacer';
import {ButtonContextProvider} from '@/components/hooks/useButtonContext';
import ThirdlyLongButton from '@/components/parts/thirdlyLongButton';
import AppText from '@/components/identities/appText';
import {questionState, settingCardModalStates} from '@/types/commonUnionType';

export type TodayTaskModalProps = Record<string, never>;

const TodayTaskModal = (_props: TodayTaskModalProps) => {
  const {height: _height} = useWindowDimensions();
  const {hideModal, activeModal, showModal} = useContext(ModalManagerContext);
  const {todayTaskSettinIdList} = useContext(QuestionHomeViewContext);
  const {setCurrentTaskSettingCardId: _setCurrentTaskSettingCardId} =
    useContext(CalendarTaskSettingViewModalContext);
  const {setCurrentSettingId} = useContext(QuestionSettingViewContext);

  const onPressOutSettingCard = useCallback(
    (id: string, cardData?: SettingCardData | null) => {
      if (!cardData) return;
      setCurrentSettingId(id, {questionModeType: cardData.questionMode});
      if (cardData.taskSetting?.taskState === questionState.completed) {
        showModal(settingCardModalStates.completedTaskModal);
      } else if (cardData.taskSetting?.isExpired) {
        // 提出可能か
        if (cardData.taskSetting?.isAbleToAnswerAfterDeadline) {
          showModal(taskSettingModalStates.todayModal);
        } else {
          showModal(settingCardModalStates.unableToAnswerModal);
        }
      } else {
        showModal(taskSettingModalStates.todayModal);
      }
    },
    [setCurrentSettingId, showModal],
  );

  return (
    <>
      <QuestionSettingViewModal id={taskSettingModalStates.todayModal} />
      <HalfModal
        id={questionHomeViewModalStates.TodayTask}
        hasHeader={false}
        isBackDropPressFreeze={false}
        modalHeaderRightButton={modalHeaderRight.none}
        style="bg-background"
      >
        <AppText style={tw`text-base text-primary font-semibold`}>
          今日の課題
        </AppText>

        <Spacer isHorizontal={false} size={8} />
        <ScrollView style={tw`w-full`}>
          {displaySettingCardList(
            todayTaskSettinIdList,
            'task',
            false,
            onPressOutSettingCard,
          )}
        </ScrollView>

        <Spacer isHorizontal={false} size={8} />
        <ButtonContextProvider
          onPressOut={() => {
            if (activeModal !== questionHomeViewModalStates.TodayTask) return;
            hideModal();
          }}
        >
          <ThirdlyLongButton text="閉じる" />
        </ButtonContextProvider>

        {/* <Spacer isHorizontal={false} size={16} /> */}
      </HalfModal>
    </>
  );
};

export default TodayTaskModal;

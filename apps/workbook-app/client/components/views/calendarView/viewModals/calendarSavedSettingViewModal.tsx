import {useCallback, useContext} from 'react';
import {useNavigation} from '@react-navigation/native';
import {View} from 'react-native-animatable';
import {
  ButtonContextProvider,
  ButtonStates,
} from '../../../hooks/useButtonContext';
import {questionMode} from '../../../../types/commonUnionType';
import type {RootViewsProps} from '../../../../types/viewParameter';
import {ModalManagerContext} from '../../../hooks/useModalManagerContext';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import HalfModal from '../../../identities/halfModal';
import Spacer from '../../../parts/spacer';
import {modalHeaderRight} from '../../../parts/halfModalHeader';
import PracticeQuestionSettingStepFive from '../../../organisms/practiceQuestionSettingStepFive';
import ExamQuestionSettingStepThree from '../../../organisms/examQuestionSettingStepThree';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import tw from '../../../../tailwind.custom';
import PrimaryShortButton from '@/components/parts/primaryShortButton';

export type InnerViewProps = Record<string, never>;

const InnerView = (_props: InnerViewProps) => {
  const calendarNavigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {hideModal} = useContext(ModalManagerContext);
  const {
    questionModeType,
    currentSelectedPracticeSettingIdList,
    currentSelectedExamSettingIdList,
  } = useContext(QuestionSettingViewContext);
  const {saveTaskQuestionSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  const onPressOut = useCallback(() => {
    hideModal(() => {
      saveTaskQuestionSetting(
        questionModeType,
        currentSelectedPracticeSettingIdList,
        currentSelectedExamSettingIdList,
      );
      /*
      calendarNavigation.navigate('ModalStack', {
        screen: 'CalendarTaskSetting',
        params: {
          isReloadCurrentSettingId: true,
        },
      });
      */
      calendarNavigation.popToTop();
    });
  }, [
    calendarNavigation,
    hideModal,
    questionModeType,
    saveTaskQuestionSetting,
    currentSelectedPracticeSettingIdList,
    currentSelectedExamSettingIdList,
  ]);

  return (
    <>
      {questionModeType === questionMode.practice ? (
        <View style={tw`w-full bg-background`}>
          <PracticeQuestionSettingStepFive />
        </View>
      ) : (
        <View style={tw`w-full bg-background`}>
          <ExamQuestionSettingStepThree />
          <Spacer isHorizontal={false} size={100} />
        </View>
      )}

      <View
        style={tw`absolute self-end bottom-0 w-100% px-5 bg-white justify-center py-4 items-center`}
      >
        <ButtonContextProvider
          state={ButtonStates.released}
          onPressOut={onPressOut}
        >
          <PrimaryShortButton text="課題に設定" />
        </ButtonContextProvider>
        <Spacer isHorizontal={false} size={16} />
      </View>
    </>
  );
};

export type CalendarSavedSettingViewModalProps = {readonly id: string};
const CalendarSavedSettingViewModal = (
  props: CalendarSavedSettingViewModalProps,
) => {
  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={props.id}
      style="bg-white"
      modalHeaderRightButton={modalHeaderRight.none}
    >
      <InnerView />
    </HalfModal>
  );
};

export default CalendarSavedSettingViewModal;

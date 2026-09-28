import {View, useWindowDimensions} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useContext} from 'react';
import Background from '../../../parts/background';
import tw from '../../../../tailwind.custom';
import {
  allScreenIdList,
  type RootViewsProps,
} from '../../../../types/viewParameter';
import BackButton from '../../../parts/backButton';
import QuestionCardButtons from '../../../organisms/questionCardButtons';
import Spacer from '../../../parts/spacer';
import {
  questionMode,
  questionSettingState,
} from '../../../../types/commonUnionType';
import {QuestionSettingViewContext} from '../../../hooks/useQuestionSettingViewContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {ButtonStates} from '../../../hooks/useButtonContext';

export type CalendarSelectQuestionModeViewModalProps = Record<string, never>;

const CalendarSelectQuestionModeViewModal = (
  _props: CalendarSelectQuestionModeViewModalProps,
) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {setCurrentSettingId, initializeQuestionInfo} = useContext(
    QuestionSettingViewContext,
  );
  const {
    temporaryTaskSetting,
    setTemporaryTaskSetting,
    resetTaskQuestionSetting,
  } = useContext(CalendarTaskSettingViewModalContext);
  const height = useWindowDimensions().height - 72; // 72はフッター分の高さ
  return (
    <>
      <Background>
        <View style={tw`h-[${height}px] items-center justify-center pb-30`}>
          <Spacer isHorizontal={false} size={24} />
          <QuestionCardButtons
            settingState={questionSettingState.task}
            resetQuestionSettingButtonState={
              temporaryTaskSetting.taskSetting?.hasTask
                ? ButtonStates.released
                : ButtonStates.disabled
            }
            onPressOutResetQuestionSetting={() => {
              resetTaskQuestionSetting();
              navigation.goBack();
            }}
            onPressOutPractice={() => {
              setCurrentSettingId('initialSetting-practice-0');
              setTemporaryTaskSetting({
                ...temporaryTaskSetting,
                questionMode: questionMode.practice,
              });
              initializeQuestionInfo();
              navigation.navigate('ModalStack', {
                userId: allScreenIdList.ModalStack,
                screen: 'PracticeQuestionSetting',
                params: {
                  userId: allScreenIdList.PracticeQuestionSetting,
                },
              });
            }}
            onPressOutExam={() => {
              setCurrentSettingId('initialSetting-exam-0');
              setTemporaryTaskSetting({
                ...temporaryTaskSetting,
                questionMode: questionMode.exam,
              });
              navigation.navigate('ModalStack', {
                userId: allScreenIdList.ModalStack,
                screen: 'ExamQuestionSetting',
                params: {
                  userId: allScreenIdList.ExamQuestionSetting,
                },
              });
            }}
            onPressOutSavedSetting={() => {
              navigation.navigate('ModalStack', {
                userId: allScreenIdList.ModalStack,
                screen: 'SavedSetting',
                params: {
                  userId: allScreenIdList.SavedSetting,
                },
              });
            }}
          />
        </View>
      </Background>
      <View
        style={tw`absolute self-end bottom-0 w-100% px-5 bg-white justify-center`}
      >
        <BackButton
          onPressOut={() => {
            navigation.goBack();
          }}
        />
      </View>
    </>
  );
};

export default CalendarSelectQuestionModeViewModal;

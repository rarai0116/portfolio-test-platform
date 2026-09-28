import {useWindowDimensions} from 'react-native';
import {useContext, useMemo} from 'react';
import {questionMode} from 'commonUnionType';
import HalfModal from '@identities/halfModal';
import {modalHeaderRight} from '@parts/halfModalHeader';
import PracticeQuestionSettingPreviewBox from '@organisms/practiceQuestionSettingPreviewBox';
import useQuestionSettingPreviewbox from '@hooks/useQuestionSettingPreviewBox';
import {ModalManagerContext} from '@hooks/useModalManagerContext';
import ExamQuestionSettingPreviewBox from '@/components/organisms/examQuestionSettingPreviewBox';
import type {ButtonStateType} from '@/components/hooks/useButtonContext';
import StartTaskFooter from '@/components/organisms/startTaskFooter';
import type {SettingCardData} from '@/components/hooks/useGlobalSaveDataContext';

export type QuestionSettingViewModalProps = {
  readonly id: string;
  readonly onPressOut: () => void;
  readonly buttonState?: ButtonStateType;
  readonly selectedTaskData: SettingCardData | null;
};
const TaskPreviewModal = (props: QuestionSettingViewModalProps) => {
  const {height} = useWindowDimensions();
  const {hideModal: _hideModal} = useContext(ModalManagerContext);

  // const {questionModeType} = useContext(QuestionSettingViewContext);
  const {practiceSettingProps, examSettingProps} = useQuestionSettingPreviewbox(
    {
      settingCard: props.selectedTaskData,
    },
  );
  const questionModeType = useMemo(() => {
    return props.selectedTaskData?.questionMode;
  }, [props.selectedTaskData]);

  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={props.id}
      style={`bg-white pb-0
      ${questionModeType === questionMode.exam ? ` h-[${height / 2}px]` : `h-[${height}px]`} `}
      modalHeaderRightButton={modalHeaderRight.none}
    >
      {questionModeType === questionMode.practice ? (
        <PracticeQuestionSettingPreviewBox {...practiceSettingProps} />
      ) : (
        <ExamQuestionSettingPreviewBox {...examSettingProps} />
      )}

      <StartTaskFooter isInReactNativeModal onPressStart={props.onPressOut} />
    </HalfModal>
  );
};

export default TaskPreviewModal;

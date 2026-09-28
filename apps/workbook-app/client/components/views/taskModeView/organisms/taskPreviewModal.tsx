import {useWindowDimensions} from 'react-native';
import {useContext, useMemo} from 'react';
import {questionMode} from 'commonUnionType';
import HalfModal from '@identities/halfModal';
import {modalHeaderRight} from '@parts/halfModalHeader';
import PracticeQuestionSettingPreviewBox from '@organisms/practiceQuestionSettingPreviewBox';
import useQuestionSettingPreviewbox from '@hooks/useQuestionSettingPreviewBox';
import {TaskModeViewContext} from '../hooks/useTaskModeViewContext';
import StartTaskPreviewModalFooter from './startTaskPreviewModalFooter';
import ExamQuestionSettingPreviewBox from '@/components/organisms/examQuestionSettingPreviewBox';
import type {ButtonStateType} from '@/components/hooks/useButtonContext';

export type QuestionSettingViewModalProps = {
  readonly id: string;
  readonly onPressOut?: () => void;
  readonly buttonState?: ButtonStateType;
};
const TaskPreviewModal = (props: QuestionSettingViewModalProps) => {
  const {height} = useWindowDimensions();

  // const {questionModeType} = useContext(QuestionSettingViewContext);
  const {selectedTaskData} = useContext(TaskModeViewContext);
  const {practiceSettingProps, examSettingProps} = useQuestionSettingPreviewbox(
    {
      settingCard: selectedTaskData,
    },
  );
  const questionModeType = useMemo(() => {
    return selectedTaskData?.questionMode;
  }, [selectedTaskData]);

  return (
    <HalfModal
      isBackDropPressFreeze
      hasHeader
      id={props.id}
      style={`bg-white
      ${questionModeType === questionMode.exam ? ` h-[${height / 2}px]` : `h-[${height}px]`} `}
      modalHeaderRightButton={modalHeaderRight.none}
    >
      {questionModeType === questionMode.practice ? (
        <PracticeQuestionSettingPreviewBox {...practiceSettingProps} />
      ) : (
        <ExamQuestionSettingPreviewBox {...examSettingProps} />
      )}

      <StartTaskPreviewModalFooter
        buttonState={props.buttonState}
        onPressOut={() => {
          props.onPressOut?.();
        }}
      />
    </HalfModal>
  );
};

export default TaskPreviewModal;

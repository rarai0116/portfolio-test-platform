import {useContext} from 'react';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import List from '../parts/list';
import Spacer from '../parts/spacer';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';

export type ExamQuestionSettingStepTwoProps = Record<string, never>;

const ExamQuestionSettingStepTwo = (
  _props: ExamQuestionSettingStepTwoProps,
) => {
  const {grade: _grade} = useContext(GlobalUserSettingContext);
  const {
    numberOfQuestions,
    setExamNumberOfQuestionsCheckedButtonInfoList,
    scrollFoward,
    examSlides,
  } = useContext(QuestionSettingViewContext);

  return (
    <>
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={numberOfQuestions[0]?.name ?? ''}
        hasIcon={false}
        hasAlert={false}
        onPressOut={() => {
          setExamNumberOfQuestionsCheckedButtonInfoList([numberOfQuestions[0]]);
          scrollFoward(examSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={numberOfQuestions[1]?.name ?? ''}
        hasIcon={false}
        hasAlert={false}
        onPressOut={() => {
          setExamNumberOfQuestionsCheckedButtonInfoList([numberOfQuestions[1]]);
          scrollFoward(examSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />

      {/* grade === questionGrade.gradeOne && (
        <List
          hasArrow
          title={numberOfQuestions[2].name}
          hasIcon={false}
          hasAlert={false}
          onPressOut={() => {
            setExamNumberOfQuestionsCheckedButtonInfoList([
              numberOfQuestions[2],
            ]);
            scrollFoward(examSlides);
          }}
        />
        )**/}
    </>
  );
};

export default ExamQuestionSettingStepTwo;

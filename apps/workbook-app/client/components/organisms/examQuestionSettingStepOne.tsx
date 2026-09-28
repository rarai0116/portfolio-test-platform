import {useContext} from 'react';
import List from '../parts/list';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import Spacer from '../parts/spacer';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import {questionGrade} from '../../types/commonUnionType';

export type ExamQuestionSettingStepOneProps = Record<string, never>;

const ExamQuestionSettingStepOne = (
  _props: ExamQuestionSettingStepOneProps,
) => {
  const {grade} = useContext(GlobalUserSettingContext);
  const {subject, setExamSubjectCheckedButtonList, scrollFoward, examSlides} =
    useContext(QuestionSettingViewContext);

  return (
    <>
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={subject[0]?.name ?? ''}
        hasIcon={false}
        hasAlert={false}
        onPressOut={() => {
          setExamSubjectCheckedButtonList([subject[0]]);
          scrollFoward(examSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={subject[1]?.name ?? ''}
        hasIcon={false}
        hasAlert={false}
        onPressOut={() => {
          setExamSubjectCheckedButtonList([subject[1]]);

          scrollFoward(examSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      {grade === questionGrade.gradeOne && (
        <List
          hasArrow
          title={subject[2]?.name ?? ''}
          hasIcon={false}
          hasAlert={false}
          onPressOut={() => {
            setExamSubjectCheckedButtonList([subject[2]]);

            scrollFoward(examSlides);
          }}
        />
      )}
    </>
  );
};

export default ExamQuestionSettingStepOne;

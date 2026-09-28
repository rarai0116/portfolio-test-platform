import {useContext, useMemo} from 'react';
import PracticeQuestionSettingPreviewBox from '@organisms/practiceQuestionSettingPreviewBox';
import {getCheckedCategoryString} from '@functionals/getCheckedCategoryString';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {questionMode} from '@/types/commonUnionType';

type PracticeQuestionSettingStepFiveProps = Record<string, never>;

const PracticeQuestionSettingStepFive = (
  _props: PracticeQuestionSettingStepFiveProps,
) => {
  const {
    questionOrderInfo,
    questionCoverageInfo,
    questionDifficultiesInfo,
    questionTimeInfo,
    questionOptionInfo,
    questionFormatInfo,
    questionNumberOfQuestionsInfo,
    checkedCategoryButtonIdList,
    questionCategoryCommonButtonList,
  } = useContext(QuestionSettingViewContext);

  const cateforyString = useMemo(() => {
    return getCheckedCategoryString(
      checkedCategoryButtonIdList,
      questionMode.practice,
      questionCategoryCommonButtonList.buttonList,
    );
  }, [checkedCategoryButtonIdList, questionCategoryCommonButtonList]);

  return (
    <PracticeQuestionSettingPreviewBox
      questionOrder={questionOrderInfo.label}
      questionCoverage={questionCoverageInfo.label}
      questionDifficulties={questionDifficultiesInfo.label}
      questionTime={questionTimeInfo.label}
      questionOption={questionOptionInfo.label}
      questionFormat={questionFormatInfo.label}
      questionNumberOfQuestions={questionNumberOfQuestionsInfo.label}
      questionCategory={cateforyString}
    />
  );
};

export default PracticeQuestionSettingStepFive;

import {useContext, useEffect, useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import tw from '../../tailwind.custom';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import Spacer from '../parts/spacer';
import {questionGrade, questionSubject} from '../../types/commonUnionType';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import AppText from '../identities/appText';
import List from '../parts/list';
import type {ButtonInfoList} from '../hooks/useCheckButtonContext';
import {GlobalSaveDataContext} from '../hooks/useGlobalSaveDataContext';

export type PracticeQuestionSettingStepTwoProps = Record<string, never>;

const PracticeQuestionSettingStepTwo = (
  _props: PracticeQuestionSettingStepTwoProps,
) => {
  const {grade} = useContext(GlobalUserSettingContext);
  const {getCategoryDataLengthMap: _getCategoryDataLengthMap} = useContext(
    GlobalSaveDataContext,
  );
  const isFocused = useIsFocused();
  const {
    scrollFoward,
    setCategorySubject,
    practiceSlides,
    questionCategoryCommonButtonList,
    currentIndex,
    getQuestionNameWithCount,
  } = useContext(QuestionSettingViewContext);

  const subjectButtonInfoList: ButtonInfoList = useMemo(() => {
    const buttonName = questionCategoryCommonButtonList.buttonList.filter(
      (v) => {
        return v.id.includes('subject-');
      },
    );

    return buttonName;
  }, [questionCategoryCommonButtonList.buttonList]);
  const subjectButtonName = useMemo(() => {
    return getQuestionNameWithCount(subjectButtonInfoList);
  }, [subjectButtonInfoList, getQuestionNameWithCount]);

  // StepTwoに移った時に、CategorySubjectをリセットする
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (currentIndex === 1) setCategorySubject(undefined);
  }, [currentIndex]);

  return (
    <>
      <Spacer isHorizontal={false} size={12} />
      <AppText style={tw`text-primary text-sm pl-8`}>カテゴリ―</AppText>
      <Spacer isHorizontal={false} size={4} />
      <List
        hasArrow
        title={subjectButtonName[0].name}
        hasIcon={false}
        hasAlert={false}
        isHidden={subjectButtonName[0].name.endsWith('(0)')}
        onPressIn={() => {
          setCategorySubject(questionSubject.subjectOne);
        }}
        onPressOut={() => {
          scrollFoward(practiceSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={subjectButtonName[1].name}
        hasIcon={false}
        hasAlert={false}
        isHidden={subjectButtonName[1].name.endsWith('(0)')}
        onPressIn={() => {
          setCategorySubject(questionSubject.subjectTwo);
        }}
        onPressOut={() => {
          scrollFoward(practiceSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      <List
        hasArrow
        title={subjectButtonName[2].name}
        hasIcon={false}
        hasAlert={false}
        isHidden={subjectButtonName[2].name.endsWith('(0)')}
        onPressIn={() => {
          setCategorySubject(questionSubject.subjectThree);
        }}
        onPressOut={() => {
          scrollFoward(practiceSlides);
        }}
      />
      <Spacer isHorizontal={false} size={12} />
      {subjectButtonName[3] !== undefined && (
        <List
          hasArrow
          title={subjectButtonName[3].name}
          hasIcon={false}
          hasAlert={false}
          isHidden={subjectButtonName[3].name.endsWith('(0)')}
          onPressIn={() => {
            setCategorySubject(questionSubject.subjectFour);
          }}
          onPressOut={() => {
            scrollFoward(practiceSlides);
          }}
        />
      )}
      <Spacer isHorizontal={false} size={12} />
      {grade === questionGrade.gradeOne ? (
        <List
          hasArrow
          title={subjectButtonName[4].name}
          hasIcon={false}
          hasAlert={false}
          isHidden={subjectButtonName[4].name.endsWith('(0)')}
          onPressIn={() => {
            setCategorySubject(questionSubject.subjectFive);
          }}
          onPressOut={() => {
            scrollFoward(practiceSlides);
          }}
        />
      ) : null}
      <Spacer isHorizontal={false} size={12} />
    </>
  );
};

export default PracticeQuestionSettingStepTwo;

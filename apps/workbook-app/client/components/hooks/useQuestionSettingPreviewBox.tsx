import {useMemo, useContext} from 'react';
import {questionMode} from 'commonUnionType';
import {getCheckedCategoryString} from '@functionals/getCheckedCategoryString';
import {practiceQuestionFormat} from '@hooks/useInitialSettingDataContext';
import type {PracticeQuestionSettingPreviewBoxProps} from '../organisms/practiceQuestionSettingPreviewBox';
import type {ExamQuestionSettingPreviewBoxProps} from '../organisms/examQuestionSettingPreviewBox';
import {QuestionSettingViewContext} from './useQuestionSettingViewContext';
import type {SettingCardData} from '@/components/hooks/useGlobalSaveDataContext';
import {InitialSettingDataContext} from '@/components/hooks/useInitialSettingDataContext';

type UsePracticeQuestionSettingPreviewBoxParams = {
  settingCard: SettingCardData | null;
};

const useQuestionSettingPreviewBox = (
  props: UsePracticeQuestionSettingPreviewBoxParams,
) => {
  const {settingCard} = props;
  //  const {getCategoryDataLengthMap} = useContext(GlobalSaveDataContext);
  const {questionCategoryCommonButtonList} = useContext(
    QuestionSettingViewContext,
  );
  const {
    initialPracticeQuestionSetting,
    initialExamQuestionInfoList,
    initialExamSubjectButtonInfoList,
  } = useContext(InitialSettingDataContext);
  const practiceSettingProps =
    // biome-ignore lint/correctness/useExhaustiveDependencies: ログ削除前の依存関係を維持し、処理の再実行条件を変更しない。
    useMemo<PracticeQuestionSettingPreviewBoxProps>(() => {
      const practiceQuestionSetting = settingCard?.practiceQuestionSetting;
      if (!practiceQuestionSetting) {
        return {
          questionFormat: '',
          questionCoverage: '',
          questionOrder: '',
          questionDifficulties: '',
          questionTime: '',
          questionOption: '',
          questionNumberOfQuestions: '',
          questionCategory: '',
        };
      }

      // questionFormat
      const qFormatId = practiceQuestionSetting.questionFormat?.[0] ?? '';
      const foundFormat = initialPracticeQuestionSetting.questionFormat.find(
        (f) => f.id === qFormatId,
      );
      const questionFormat = foundFormat ? foundFormat.name : '';
      const isQaa = questionFormat === practiceQuestionFormat.qAndA.name;

      // questionCoverage
      const qCoverageId = practiceQuestionSetting.questionCoverage?.[0] ?? '';
      const foundCoverage =
        initialPracticeQuestionSetting.questionCoverage.find(
          (c) => c.id === qCoverageId,
        );
      const questionCoverage = foundCoverage ? foundCoverage.name : '';

      // questionOrder
      const qOrderId = practiceQuestionSetting.questionOrder?.[0] ?? '';
      const foundOrder = initialPracticeQuestionSetting.questionOrder.find(
        (o) => o.id === qOrderId,
      );
      const questionOrder = foundOrder ? foundOrder.name : '';

      // questionDifficulties: 複数選択のため reduce
      const questionDifficulties =
        initialPracticeQuestionSetting.questionDifficulties
          .reduce<string[]>((acc, difficulty) => {
            if (
              practiceQuestionSetting.questionDifficulties.includes(
                difficulty.id,
              )
            ) {
              acc.push(difficulty.name);
            }

            return acc;
          }, [])
          .join('/') || '';

      // questionTime
      const firstTimeId = practiceQuestionSetting.questionTime?.[0];
      let questionTime = '';
      if (
        firstTimeId &&
        initialPracticeQuestionSetting.questionTime?.[0]?.id === firstTimeId
      ) {
        questionTime = initialPracticeQuestionSetting.questionTime[0].name;
      } else if (firstTimeId) {
        const matchRes = /\d*$/.exec(firstTimeId);
        questionTime = matchRes ? `${matchRes[0]}分` : '';
      }

      // questionOption
      const qOptionId = practiceQuestionSetting.option?.[0];
      const foundOption = initialPracticeQuestionSetting.option.find(
        (o) => o.id === qOptionId,
      );
      const questionOption = foundOption ? foundOption.name : '';

      // questionNumberOfQuestions
      const firstNum = practiceQuestionSetting.numberOfQuestions?.[0];
      const matchNum = firstNum ? /\d*$/.exec(firstNum) : null;
      const questionNumberOfQuestions = `${matchNum ? matchNum[0] : ''}問`;

      // questionCategory
      const questionCategory =
        getCheckedCategoryString(
          isQaa
            ? practiceQuestionSetting.qaaQuestionCategory
            : practiceQuestionSetting.questionCategory,
          questionMode.practice,
          questionCategoryCommonButtonList.buttonList,
        ) ?? '';

      return {
        questionFormat,
        questionCoverage,
        questionOrder,
        questionDifficulties,
        questionTime,
        questionOption,
        questionNumberOfQuestions,
        questionCategory,
      };
    }, [
      settingCard,
      initialPracticeQuestionSetting,
      //      getCategoryData,
      questionCategoryCommonButtonList,
      initialExamQuestionInfoList,
      initialExamSubjectButtonInfoList,
    ]);
  const examSettingProps = useMemo<ExamQuestionSettingPreviewBoxProps>(() => {
    const examQuestionSetting = settingCard?.examQuestionSetting;

    if (
      !settingCard ||
      !examQuestionSetting ||
      examQuestionSetting.numberOfQuestions.length === 0 ||
      examQuestionSetting.subject.length === 0
    ) {
      return {
        questonCoverage: '',
        questionNumberOfQuestions: '',
      };
    }

    const questionGrade = settingCard.grade;
    // questonCoverage
    const [_all, _eqs, _grade, subjectId] =
      /(.*)_(.*)_(.*)$/.exec(examQuestionSetting.subject?.[0]) ?? '';
    const foundSubject =
      initialExamQuestionInfoList[questionGrade]?.[subjectId];
    const questonCoverage = foundSubject.subjectName ?? '';

    // questionNumberOfQuestions
    const questionNumberOfQuestions = `${
      foundSubject.numberOfQuestions ?? '-'
    }問`;

    return {questonCoverage, questionNumberOfQuestions};
  }, [settingCard, initialExamQuestionInfoList]);

  return {practiceSettingProps, examSettingProps};
};

export default useQuestionSettingPreviewBox;

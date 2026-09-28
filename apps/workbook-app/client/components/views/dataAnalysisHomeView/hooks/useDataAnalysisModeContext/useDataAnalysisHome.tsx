import {useMemo} from 'react';
import type {PieChartDataType} from '../../organisms/dataAnalysisPieChartCard';
import type {TestIdList} from '../../../../hooks/useGlobalUserSettingContext';
import type {QuestionGradeType} from '../../../../../types/commonUnionType';

export type AnalysisHomeDataSet = {
  totalSolvedQuestions: number;
  pieChartData: PieChartDataType[];
};
export type AnalysisHomeRecords = {
  [key: string]: AnalysisHomeDataSet;
  multipleChoice: AnalysisHomeDataSet;
  qAndA: AnalysisHomeDataSet;
};

type DataAnalysisHomeProps = {
  testIdList: TestIdList;
  grade: QuestionGradeType | undefined;
  totalChoicesTestNumber: number;
};

const useDataAnalysisHome = (
  props: DataAnalysisHomeProps,
): AnalysisHomeRecords => {
  const multipleChoice = useMemo(() => {
    const regExp = new RegExp(`^ch_${props.grade === '1級' ? 0 : 1}_`);
    // 解いた問題数
    const totalSolvedQuestionsTargets = props.testIdList.answered.total.filter(
      (testId) => testId.match(regExp),
    );
    const totalSolvedQuestions = totalSolvedQuestionsTargets.length;
    // 苦手
    const weakQuestionsTargets = props.testIdList.weakPoint.total.filter(
      (testId) => testId.match(regExp),
    );
    const weakQuestions = weakQuestionsTargets.length;
    // 正解かつ苦手じゃない
    const correctQuestionsTargets = props.testIdList.correctlyAnswered.total
      .filter((testId) => testId.match(regExp))
      .filter((testId) => !weakQuestionsTargets.includes(testId));
    const correctQuestions = correctQuestionsTargets.length;
    // 未解答
    const unAnsweredQuestions =
      props.totalChoicesTestNumber - correctQuestions - weakQuestions;
    const pieChartData: PieChartDataType[] = [
      {
        name: '正解',
        numberOfQuestions: correctQuestions,
      },
      {
        name: '苦手',
        numberOfQuestions: weakQuestions,
      },
      {
        name: '未回答',
        numberOfQuestions: unAnsweredQuestions,
      },
    ];
    return {
      totalSolvedQuestions,
      pieChartData,
    };
  }, [props.testIdList, props.grade, props.totalChoicesTestNumber]);
  const qAndA = useMemo(() => {
    const regExp = new RegExp(`^qaa[0-9]_${props.grade === '1級' ? 0 : 1}_`);
    // 解いた問題数
    const totalSolvedQuestionsTargets = props.testIdList.answered.total.filter(
      (testId) => testId.match(regExp),
    );
    const totalSolvedQuestions = totalSolvedQuestionsTargets.length;
    // 苦手
    const weakQuestionsTargets = props.testIdList.weakPoint.total.filter(
      (testId) => testId.match(regExp),
    );
    const weakQuestions = weakQuestionsTargets.length;
    // 正解かつ苦手じゃない
    const correctQuestionsTargets = props.testIdList.correctlyAnswered.total
      .filter((testId) => testId.match(regExp))
      .filter((testId) => !weakQuestionsTargets.includes(testId));
    const correctQuestions = correctQuestionsTargets.length;
    // 未解答
    const unAnsweredQuestions =
      props.totalChoicesTestNumber - correctQuestions - weakQuestions;
    const pieChartData: PieChartDataType[] = [
      {
        name: '正解',
        numberOfQuestions: correctQuestions,
      },
      {
        name: '苦手',
        numberOfQuestions: weakQuestions,
      },
      {
        name: '未回答',
        numberOfQuestions: unAnsweredQuestions,
      },
    ];
    return {
      totalSolvedQuestions,
      pieChartData,
    };
  }, [props.testIdList, props.grade, props.totalChoicesTestNumber]);

  const dataAnalysisHomeData: AnalysisHomeRecords = useMemo(() => {
    return {multipleChoice, qAndA};
  }, [multipleChoice, qAndA]);
  return dataAnalysisHomeData;
};

export default useDataAnalysisHome;

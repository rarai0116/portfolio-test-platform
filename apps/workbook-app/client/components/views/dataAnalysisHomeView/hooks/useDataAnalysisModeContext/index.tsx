import {createContext, useMemo} from 'react';
import type {ReactNode} from 'react';
import type {AnalysisHomeDataSet} from './useDataAnalysisHome';
import useDataAnalysisHome from './useDataAnalysisHome';
import useRaderChartData from './useRaderChartData';
import type {
  RaderChartDataSet,
  RadarChartGradeOneType,
  RadarChartGradeTwoType,
} from './useRaderChartData';
import useCommonHooks, {type PublicCommonHooks} from './useCommonHooks';
import useDataAnalysisCategoryData, {
  type DataAnalysisCategoryData,
  type CategoryData,
} from './useDataAnalysisCategoryData';
import useStudyHoursData, {type StudyHoursData} from './useStudyHoursData';
import useDataAnalysisQuestionSetting, {
  type DataAnalysisQuestionSetting,
} from './useDataAnalysisQuestionSetting';

export type DataAnalysisCategoryDataType = CategoryData;

type DataAnalysisContextObject = {
  dataAnalysisHomeData: Record<string, AnalysisHomeDataSet>;
  getNumberOfQuestionsPercentList: (numberOfQuestions: number[]) => number[];
} & RaderChartDataSet<RadarChartGradeOneType | RadarChartGradeTwoType> &
  DataAnalysisQuestionSetting &
  PublicCommonHooks &
  DataAnalysisCategoryData &
  StudyHoursData;

type Props = {
  readonly children: ReactNode;
};

export const DataAnalysisContext = createContext<DataAnalysisContextObject>(
  {} as DataAnalysisContextObject,
);
const DataAnalysisContextProvider = (props: Props) => {
  const {publicHooks, choicestestDataList, grade, testIdList} =
    useCommonHooks();
  const dataAnalysisSetting = useDataAnalysisQuestionSetting();

  const dataAnalysisHomeData = useDataAnalysisHome({
    testIdList,
    grade,
    totalChoicesTestNumber: choicestestDataList.length,
  });
  const dataAnalysisCategoryData = useDataAnalysisCategoryData({
    qaaCategoryDataLengthMap: publicHooks.categoryDataLengthMap.qAndA,
    multipleChoiceCategoryDataLengthMap:
      publicHooks.categoryDataLengthMap.multipleChoice,
  });
  const radarChartData = useRaderChartData({
    grade,
    categoryDataLengthMap: publicHooks.categoryDataLengthMap.currentlySelected,
  });

  const studyHoursData = useStudyHoursData();

  const value = useMemo(() => {
    return {
      ...dataAnalysisSetting,
      dataAnalysisHomeData,
      ...radarChartData,
      ...publicHooks,
      ...dataAnalysisCategoryData,
      ...studyHoursData,
    };
  }, [
    dataAnalysisSetting,
    dataAnalysisHomeData,
    radarChartData,
    publicHooks,
    studyHoursData,
    dataAnalysisCategoryData,
  ]);

  return (
    <DataAnalysisContext.Provider value={value}>
      {props.children}
    </DataAnalysisContext.Provider>
  );
};

export default DataAnalysisContextProvider;

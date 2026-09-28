import {useMemo} from 'react';
import type {QuestionGradeType} from '../../../../../types/commonUnionType';
import type {CategoryDataLengthMap} from '../../../../hooks/useGlobalSaveDataContext';

export type RadarChartDataItemKey = 'user' | 'goal';
const RaderChartGradeOneStates = {
  学科Ⅰ: '計画',
  学科Ⅱ: '環境設備',
  学科Ⅲ: '法規',
  学科Ⅳ: '構造',
  学科Ⅴ: '施工',
} as const;
export type RadarChartGradeOneKey =
  (typeof RaderChartGradeOneStates)[keyof typeof RaderChartGradeOneStates];
const RaderChartGradeTwoStates = {
  学科Ⅰ: '計画',
  学科Ⅱ: '法規',
  学科Ⅲ: '構造',
  学科Ⅳ: '施工',
} as const;
export type RadarChartGradeTwoKey =
  (typeof RaderChartGradeTwoStates)[keyof typeof RaderChartGradeTwoStates];
export type RadarChartGradeOneType = {
  [key in RadarChartGradeOneKey]: number;
};
export type RadarChartGradeTwoType = {
  [key in RadarChartGradeTwoKey]: number;
};

export type DataAnalysisRadarChartData<
  T extends RadarChartGradeOneType | RadarChartGradeTwoType,
> = {
  [key in RadarChartDataItemKey]: T;
};
export type RadarChartGradeType<T> = T extends RadarChartGradeOneKey
  ? RadarChartGradeOneType
  : RadarChartGradeTwoType;
export type RaderChartDataSet<
  T extends RadarChartGradeOneType | RadarChartGradeTwoType,
> = {
  grade: QuestionGradeType;
  radarChartData: DataAnalysisRadarChartData<T>;
};

type UseRadarChartDataProps = {
  readonly grade?: QuestionGradeType;
  readonly categoryDataLengthMap: CategoryDataLengthMap;
};

function createRaderChartData<
  T extends RadarChartGradeOneKey | RadarChartGradeTwoKey,
>(
  keys: T[],
  categoryDataLengthMap: CategoryDataLengthMap,
): DataAnalysisRadarChartData<RadarChartGradeType<T>> {
  return keys.reduce<DataAnalysisRadarChartData<RadarChartGradeType<T>>>(
    (acc, radarChartKey) => {
      const total =
        categoryDataLengthMap[radarChartKey]?.totalList._total.length ?? 0;
      const weaklyOrNotAnswered =
        categoryDataLengthMap[radarChartKey]?.weakPointOrUnAnswered._total
          .length ?? 0;
      const answeredAndNotWeakly = total - weaklyOrNotAnswered;
      // 小数点第二位まで表示
      const user =
        total === 0 ? 0 : Math.round((answeredAndNotWeakly / total) * 10) / 10;
      const goal = 0.9;
      return {
        user: {...acc.user, [radarChartKey]: user},
        goal: {...acc.goal, [radarChartKey]: goal},
      };
    },
    {
      user: keys.reduce(
        (acc, key) => {
          acc[key] = 0;
          return acc;
        },
        {} as RadarChartGradeType<T>,
      ),
      goal: keys.reduce(
        (acc, key) => {
          acc[key] = 0;
          return acc;
        },
        {} as RadarChartGradeType<T>,
      ),
    },
  );
}

const useRaderChartData = (props: UseRadarChartDataProps) => {
  const radarChartData = useMemo<
    DataAnalysisRadarChartData<RadarChartGradeOneType | RadarChartGradeTwoType>
  >(() => {
    if (props.grade === '1級') {
      return createRaderChartData<RadarChartGradeOneKey>(
        Object.keys(RaderChartGradeOneStates) as RadarChartGradeOneKey[],
        props.categoryDataLengthMap,
      );
    } else {
      return createRaderChartData<RadarChartGradeTwoKey>(
        Object.keys(RaderChartGradeTwoStates) as RadarChartGradeTwoKey[],
        props.categoryDataLengthMap,
      );
    }
  }, [props.grade, props.categoryDataLengthMap]);

  const radarChartDataSet = useMemo(() => {
    return {radarChartData, grade: props.grade ?? '2級'};
  }, [radarChartData, props.grade]);

  return radarChartDataSet;
};

export default useRaderChartData;

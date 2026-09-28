import {useState, useMemo, useContext} from 'react';
import {GlobalUserSettingContext} from '../../../../hooks/useGlobalUserSettingContext';
import type {
  CategoryDataLengthMap,
  SettingCardData,
} from '../../../../hooks/useGlobalSaveDataContext';

export type CategoryDataCell = {
  [key: string]: number;
  correctlyAndNoWeakly: number;
  weakly: number;
  noAnswered: number;
};
export type CategoryData = {
  [key: string]: CategoryDataCell | string;
  id: string;
  multipleChoice: CategoryDataCell;
  qAndA: CategoryDataCell;
};
export type CategoryDataSet = CategoryData[];

type DataAnalysisCategoryDataProps = {
  qaaCategoryDataLengthMap: CategoryDataLengthMap;
  multipleChoiceCategoryDataLengthMap: CategoryDataLengthMap;
  // Define the props of your hook here
};
export type DataAnalysisCategoryData = {
  categoryDataSet: CategoryDataSet;
  categoryDataKeyList: string[];
  selectedTask: SettingCardData | null;
  setSelectedTask: (taskId: SettingCardData | null) => void;
};

const useDataAnalysisCategoryData = (props: DataAnalysisCategoryDataProps) => {
  const {readyForTest} = useContext(GlobalUserSettingContext);
  const [selectedTask, setSelectedTask] = useState<SettingCardData | null>(
    null,
  );
  /** ここは効率化できる余地が大いにあるがやっていない */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const {categoryDataSet, categoryDataKeyList} = useMemo(() => {
    if (readyForTest.isUser)
      return {categoryDataSet: [], categoryDataKeyList: []};
    const keys = new Set(
      [
        ...Object.keys(props.multipleChoiceCategoryDataLengthMap),
        ...Object.keys(props.qaaCategoryDataLengthMap),
      ].filter((key) => !key.endsWith('-なし')),
    );
    // console.log('keys', keys);
    // keysは学科[Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ]-?.*-?.*という形のツリー構造を持っている
    // 例えば学科Ⅰ-計画-基本計画は学科Ⅰ-計画を親とし、学科Ⅰ-計画は学科Ⅰを親とする
    // 根は学科Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴである
    // このツリー構造を[祖A,親A-A,子A-A-A,子A-A-B...親A-B...,祖B...,親B-A,子B-A-A...]という順番に並び替えた一次配列を作成するアルゴリズムを考える
    // まず、keysをsubject|big|smallに分ける
    const subjectKeys = Array.from(keys).filter((key) => !key.includes('-'));
    // keyに-が1つだけ含まれるものをbigKeysとする
    const bigKeys = Array.from(keys).filter(
      (key) => key.split('-').length === 2,
    );
    // keyに-が2つ含まれるものをsmallKeysとする
    const smallKeys = Array.from(keys).filter(
      (key) => key.split('-').length === 3,
    );
    subjectKeys.sort();
    bigKeys.sort();
    smallKeys.sort();
    /*
    console.log('subjectKeys', subjectKeys);
    console.log('bigKeys', bigKeys);
    console.log('smallKeys', smallKeys);
    */
    const categoryDataKeyList = subjectKeys.reduce<string[]>(
      (acc, subjectKey) => {
        acc.push(subjectKey);
        const bigKeysOfSubject = bigKeys.filter((bigKey) =>
          bigKey.startsWith(subjectKey),
        );
        for (const bigKey of bigKeysOfSubject) {
          acc.push(bigKey);
          const smallKeysOfBig = smallKeys.filter((smallKey) =>
            smallKey.startsWith(bigKey),
          );
          smallKeysOfBig.sort();
          for (const smallKey of smallKeysOfBig) {
            acc.push(smallKey);
          }
        }

        return acc;
      },
      [],
    );
    // console.log('categoryDataKeyList', categoryDataKeyList);
    const categoryDataSet = categoryDataKeyList.reduce<CategoryDataSet>(
      (acc, key) => {
        /*
        console.log('key', key);
        console.log(
          'props.multipleChoiceCategoryDataLengthMap[key]',
          props.multipleChoiceCategoryDataLengthMap[key],
        );
        console.log(
          'props.qaaCategoryDataLengthMap[key]',
          props.qaaCategoryDataLengthMap[key],
        );
        */
        const multipleChoice = props.multipleChoiceCategoryDataLengthMap[key]
          ? {
              correctlyAndNoWeakly:
                props.multipleChoiceCategoryDataLengthMap[key].totalList._total
                  .length -
                props.multipleChoiceCategoryDataLengthMap[key]
                  .weakPointOrUnAnswered._total.length,
              weakly:
                props.multipleChoiceCategoryDataLengthMap[key].weakList._total
                  .length,
              noAnswered:
                props.multipleChoiceCategoryDataLengthMap[key]
                  .weakPointOrUnAnswered._total.length -
                props.multipleChoiceCategoryDataLengthMap[key].weakList._total
                  .length,
            }
          : {
              correctlyAndNoWeakly: -1,
              weakly: -1,
              noAnswered: -1,
            };
        const qAndA = props.qaaCategoryDataLengthMap[key]
          ? {
              correctlyAndNoWeakly:
                props.qaaCategoryDataLengthMap[key].totalList._total.length -
                props.qaaCategoryDataLengthMap[key].weakPointOrUnAnswered._total
                  .length,
              weakly:
                props.qaaCategoryDataLengthMap[key].weakList._total.length,
              noAnswered:
                props.qaaCategoryDataLengthMap[key].weakPointOrUnAnswered._total
                  .length -
                props.qaaCategoryDataLengthMap[key].weakList._total.length,
            }
          : {
              correctlyAndNoWeakly: -1,
              weakly: -1,
              noAnswered: -1,
            };
        const categoryData: CategoryData = {
          id: key,
          multipleChoice,
          qAndA,
        };
        // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
        return [...acc, categoryData];
      },
      [],
    );
    return {categoryDataKeyList, categoryDataSet};
    // readyForTestの更新で再計算しないように調整
  }, [
    props.multipleChoiceCategoryDataLengthMap,
    props.qaaCategoryDataLengthMap,
  ]);

  return {
    categoryDataSet,
    categoryDataKeyList,
    selectedTask,
    setSelectedTask,
  };
};

export default useDataAnalysisCategoryData;

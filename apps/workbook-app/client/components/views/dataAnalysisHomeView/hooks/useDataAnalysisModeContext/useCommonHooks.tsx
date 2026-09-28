import {useCallback, useMemo, useState, useContext} from 'react';
import {
  GlobalSaveDataContext,
  type CategoryDataLengthMap,
} from '../../../../hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '../../../../hooks/useGlobalUserSettingContext';

type CategoryDataLengthMaps = {
  [key: string]: CategoryDataLengthMap;
  multipleChoice: CategoryDataLengthMap;
  qAndA: CategoryDataLengthMap;
  currentlySelected: CategoryDataLengthMap;
};
export type PublicCommonHooks = {
  isQaa: boolean;
  setIsQaa: React.Dispatch<React.SetStateAction<boolean>>;
  categoryDataLengthMap: CategoryDataLengthMaps;
  getNumberOfQuestionsPercentList: (numberOfQuestions: number[]) => number[];
};

const useCommonHooks = () => {
  const {getCategoryDataLengthMap, getTestDataList} = useContext(
    GlobalSaveDataContext,
  );
  const {testIdList, grade} = useContext(GlobalUserSettingContext);

  const [isQaa, setIsQaa] = useState<boolean>(false);
  const choicestestDataList = useMemo(() => {
    return getTestDataList(isQaa);
  }, [getTestDataList, isQaa]);
  const multipleChoicesCategoryDataLengthMap = useMemo(
    () => getCategoryDataLengthMap(false),
    [getCategoryDataLengthMap],
  );
  const qaaCategoryDataLengthMap = useMemo(
    () => getCategoryDataLengthMap(true),
    [getCategoryDataLengthMap],
  );
  const categoryDataLengthMap: CategoryDataLengthMaps = useMemo(() => {
    console.log('⭐️categoryDataLengthMap更新');
    return {
      multipleChoice: multipleChoicesCategoryDataLengthMap,
      qAndA: qaaCategoryDataLengthMap,
      currentlySelected: isQaa
        ? qaaCategoryDataLengthMap
        : multipleChoicesCategoryDataLengthMap,
    };
  }, [multipleChoicesCategoryDataLengthMap, qaaCategoryDataLengthMap, isQaa]);

  const getNumberOfQuestionsPercentList: (
    numberOfQuestions: number[],
  ) => number[] = useCallback((numberOfQuestions: number[]) => {
    const totalNumberOfQuestions = numberOfQuestions.reduce((sum, element) => {
      return sum + element;
    }, 0);

    return numberOfQuestions.map((v) => {
      return Math.round((v / totalNumberOfQuestions) * 100);
    });
  }, []);

  const publicHooks: PublicCommonHooks = {
    isQaa,
    setIsQaa,
    categoryDataLengthMap,
    getNumberOfQuestionsPercentList,
  };

  return {
    publicHooks,
    choicestestDataList,
    grade,
    testIdList,
  };
};

export default useCommonHooks;

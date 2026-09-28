import type {ButtonInfoList} from '../hooks/useCheckButtonContext';
import {CheckButtonStates} from '../hooks/useCheckButtonContext';
import {
  type CategoryDataLengthMap,
  type CategoryDataLengthCell,
  DifficultiesMap,
  type DifficultiesMapValues,
} from '../hooks/useGlobalSaveDataContext';
import type {QuestionCoverageType} from '../../types/commonUnionType';
import {questionCoverage} from '../../types/commonUnionType';

export const getEachCategoryNumberOfQuestions = (
  cell: CategoryDataLengthCell,
  type: QuestionCoverageType,
  checkedDifficultiesButtonInfoList?: ButtonInfoList,
) => {
  if (
    !checkedDifficultiesButtonInfoList ||
    checkedDifficultiesButtonInfoList.length === 0
  )
    return 0;

  const difficulties = checkedDifficultiesButtonInfoList.reduce<
    DifficultiesMapValues[]
  >((acc, buttonInfo) => {
    if (!buttonInfo || typeof buttonInfo.value === 'number') return acc;
    switch (buttonInfo.value) {
      case 'one': {
        // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
        return [...acc, DifficultiesMap.one];
      }

      case 'two': {
        // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
        return [...acc, DifficultiesMap.two];
      }

      case 'three': {
        // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
        return [...acc, DifficultiesMap.three];
      }

      default: {
        return acc;
      }
    }
  }, []);

  return difficulties.reduce((acc, difficulty) => {
    if (type === questionCoverage.all)
      return acc + cell.totalList[difficulty].length;
    if (type === questionCoverage.onlyUnanswered)
      return acc + cell.unansweredList[difficulty].length;
    if (type === questionCoverage.onlyWeakSpot)
      return acc + cell.weakList[difficulty].length;
    if (type === questionCoverage.bothUnCorrectlyAndWeakSpot)
      return acc + cell.weakPointOrUnAnswered[difficulty].length;
    return acc;
  }, 0);
};

const _getCategoryButtonName = (
  key: string,
  cell: CategoryDataLengthCell,
  type: QuestionCoverageType,
  checkedDifficultiesButtonInfoList: ButtonInfoList,
) => {
  if (!cell) return key;
  if (!type) return key;

  return `${key} (${getEachCategoryNumberOfQuestions(cell, type, checkedDifficultiesButtonInfoList)})`;
};

// categoryDataのデータを元にButtonInfolistを構築
export const getCategoryCheckBoxInfoList = (
  //  categoryData: CategoryData,
  categoryDataLengthMap: CategoryDataLengthMap,
  _type: QuestionCoverageType,
  _checkedDifficultiesButtonInfoList: ButtonInfoList,
) => {
  /* console.log(
    'getCategoryCheckBoxInfoList()',
    categoryData,
    categoryDataLengthMap,
    type,
    checkedDifficultiesButtonInfoList,
  ); */
  const keys = Object.keys(categoryDataLengthMap);
  // -を含まないキーは学科
  const subjectKeys = keys.filter((key) => !key.includes('-'));
  // -を一つだけ含むキーは大カテゴリ
  const bigCategoryKeys = keys.filter(
    (key) => key.includes('-') && key.split('-').length === 2,
  );
  // -を二つ含むキーは小カテゴリ
  const smallCategoryKeys = keys.filter(
    (key) => key.includes('-') && key.split('-').length === 3,
  );
  return subjectKeys.reduce<ButtonInfoList>((acc, subjectKey) => {
    const subjectButtonInfo = {
      id: `subject-${subjectKey}`,
      name: subjectKey /* getCategoryButtonName(
        subjectKey,
        categoryDataLengthMap[subjectKey],
        type,
        checkedDifficultiesButtonInfoList,
      ) */,
      initialState: CheckButtonStates.unchecked,
      parentName: '',
      value: subjectKey,
    };
    // console.log('categoryDataLengthMap', categoryDataLengthMap);
    const bigCategoryKeysForSubject = bigCategoryKeys.filter((key) =>
      key.includes(subjectKey),
    );
    const bigCategoryButtonInfoList =
      bigCategoryKeysForSubject.reduce<ButtonInfoList>(
        (acc2, bigCategoryKey) => {
          const name = bigCategoryKey.replace(`${subjectKey}-`, '');
          const bigCategoryButtonInfo = {
            id: `big-${bigCategoryKey}`,
            name /* getCategoryButtonName(
              name,
              categoryDataLengthMap[bigCategoryKey],
              type,
              checkedDifficultiesButtonInfoList,
            ), */,
            initialState: CheckButtonStates.unchecked,
            parentName: `big-${subjectKey}`,
            value: name,
          };
          const smallCategoryKeysForBigCategory = smallCategoryKeys.filter(
            (key) => key.includes(bigCategoryKey),
          );
          const smallCategoryButtonInfoList =
            smallCategoryKeysForBigCategory.reduce<ButtonInfoList>(
              (acc3, smallCategoryKey) => {
                const name = smallCategoryKey.replace(`${bigCategoryKey}-`, '');
                const smallCategoryButtonInfo = {
                  id: `small-${smallCategoryKey}`,
                  name /* getCategoryButtonName(
                    name,
                    categoryDataLengthMap[smallCategoryKey],
                    type,
                    checkedDifficultiesButtonInfoList,
                  ) */,
                  initialState: CheckButtonStates.unchecked,
                  parentName: `big-${bigCategoryKey}`,
                  value: name,
                };
                // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
                return [...acc3, smallCategoryButtonInfo];
              },
              [],
            );
          return [
            // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
            ...acc2,
            bigCategoryButtonInfo,
            ...smallCategoryButtonInfoList,
          ];
        },
        [],
      );

    // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
    return [...acc, subjectButtonInfo, ...bigCategoryButtonInfoList];
  }, []);
};

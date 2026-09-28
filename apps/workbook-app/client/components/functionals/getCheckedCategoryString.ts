import {type QuestionModeType, questionMode} from '../../types/commonUnionType';
import type {ButtonInfoList} from '../hooks/useCheckButtonContext';

export const getCheckedCategoryString = (
  checkedIdList: string[],
  mode: QuestionModeType,
  buttonInfoList: ButtonInfoList,
) => {
  /*
  console.log(
    'getCheckedCategoryString',
    checkedIdList,
    mode,
    categoryData,
    categoryDataLengthMap,
  );
  */
  if (mode === questionMode.exam) {
    return checkedIdList[0];
  }

  // categoryCheckBoxInfoListのbuttonListのインデックス順に並び替え
  const checkedButtonIdList: string[] = checkedIdList.sort((a, b) => {
    const indexA = buttonInfoList.findIndex((item) => item.id === a);
    const indexB = buttonInfoList.findIndex((item) => item.id === b);
    return indexA - indexB;
  });

  const groupBySubject: Record<
    string,
    Record<string, string[]>
  > = checkedButtonIdList.reduce(
    (acc: Record<string, Record<string, string[]>>, item: string) => {
      const match = /(学科\D)-([^-]+)-([^-]+)/.exec(item);

      if (match) {
        const [, subject, bigCategory, smallCategory] = match;
        acc[subject] ??= {};
        acc[subject][bigCategory] ??= [];
        acc[subject][bigCategory].push(smallCategory);
      }

      return acc;
    },
    {},
  );
  // console.log('groupBySubject', groupBySubject);

  const result: string = Object.entries(groupBySubject)
    .map(([subject, bigCategory]) => {
      // console.log('subject', subject); // 学科
      // console.log('bigCategory', bigCategory);
      const bigCategoryString = Object.entries(bigCategory).map(
        ([bigCategory, smallCategory]) => {
          const smallCategoryString = smallCategory.join(',');
          // console.log('smallCategoryString', `${smallCategoryString}`);
          return `${bigCategory}(${smallCategoryString})`;
        },
      );
      return `${subject}/${bigCategoryString}`;
    })
    .join('|');
  // console.log('result', result);
  return result;

  /*
  const checkedIdListWithIndex = checkedIdList.map((v) => ({
    id: v,
    index: buttonInfoList.findIndex((dataItem) => dataItem.id === v),
  }));

  // 元のデータのインデックスに基づいてソート
  const sortedCheckedBoxList = checkedIdListWithIndex.sort(
    (a, b) => a.index - b.index,
  );

  // プロパティ(index)を削除
  const finalCheckedButtonList = sortedCheckedBoxList.map(
    ({index, ...rest}) => rest,
  );
  // idのみの配列を作成
  const checkedButtonIdList = finalCheckedButtonList.map((item) => item.id);

  */

  // 学科/大(小,小),大(小,小）の形式
  /*
  const groupBySubject: Record<
    string,
    Record<string, string[]>
  > = checkedButtonIdList.reduce(
    (acc: Record<string, Record<string, string[]>>, item: string) => {
      // console.log('item', item);
      // console.log('acc', acc);
      // 学科
      const subjectMatch: RegExpExecArray | null = /(学科\D)/.exec(item);
      const bigCategoryMatch: RegExpExecArray | null = /(学科\D)-([^-]+)/.exec(
        item,
      );
      const smallCategoryMatch: RegExpExecArray | null =
        /(学科\D)-([^-]+)-([^-]+)/.exec(item);

      if (subjectMatch !== null) {
        const subject: string = subjectMatch[0];

        if (bigCategoryMatch !== null) {
          const bigCategory: string = bigCategoryMatch[2];
          if (smallCategoryMatch !== null) {
            const smallCategory: string = smallCategoryMatch[3];
            // console.log('subject', subject);
            // console.log('bigCategory', bigCategory);
            // console.log('smallCategory!', smallCategory);
            acc[subject] ??= {};
            acc[subject][bigCategory] ??= [];

            acc[subject][bigCategory].push(smallCategory);
          }
        }
      }

      return acc;
    },
    {},
  );
  */
  // }
};

// //学科/大,大(小,小,小,小),大(小・小）の形式
/* const groupBySubject: Record<string, string[]> = checkedButtonIdList.reduce(
        (acc: Record<string, string[]>, item: string) => {
            const match: RegExpExecArray | null = /(学科\D)/.exec(item);

            if (match !== null) {
                const subject: string = match[0];
                if (!acc[subject]) {
                    console.log('accsbj', acc[subject]);
                    acc[subject] = [];
                }

                acc[subject].push(item);
            }

            return acc;
        },
        {},
    );
    console.log('groupBySubject', groupBySubject);

    const formattedString = Object.entries(groupBySubject)
        .map(([subject, items]) => {
            console.log('subItem', subject, items);

            const smallCategoryString = items
                .filter((item) => {
                    return item.includes('small-');
                })
                .map((item) => {
                    return item.replace(/(small-学科\D-.+-)(.+)/, '$2');
                })
                .join(',');

            console.log('small', `${smallCategoryString}`);

            const bigCategoryString = items
                .filter((item) => {
                    return item.includes('big-');
                })
                .map((item) => {
                    return item.replace(/big-学科\D-/, '');
                });
            console.log(bigCategoryString);

            const string = `${subject}/${bigCategoryString}(${smallCategoryString})`;
            console.log(string);

            return string;
        })
        .join('|');

    console.log(formattedString); */

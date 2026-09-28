import {
  createContext,
  useMemo,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
/* import {categoryCheckBoxInfoList} from '../functionals/getCategoryCheckBoxInfoList'; */
import {questionGrade} from '../../types/commonUnionType';
import type {
  PracticeQuestionSettingType,
  PracticeQuestionSettingIdList,
  ExamQuestionSettingIdList,
} from './useQuestionSettingViewContext';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';
import {CheckButtonStates, type ButtonInfoList} from './useCheckButtonContext';

export type ExamQuestionSettingInfoType = {
  subjectName: string;
  categoryName: string;
  numberOfQuestions: number;
  time: number;
};

type InitialSettingDataContextObject = {
  initialPracticeQuestionSetting: PracticeQuestionSettingType;
  initialPracticeQuestionSettingId: PracticeQuestionSettingIdList;
  initialExamQuestionInfoList: Record<
    string,
    Record<string, ExamQuestionSettingInfoType>
  >;
  initialExamSubjectButtonInfoList: ButtonInfoList;
  getExamNumberOfQuestionsButtonInfoList: (subject: string) => ButtonInfoList;
  initialExamQuestionSettingId: ExamQuestionSettingIdList;
  idToCheckedButtonInfoList: (
    id: string,
    list: ButtonInfoList,
  ) => ButtonInfoList;
  idListToCheckedButtonList: (
    idList: string[],
    list: ButtonInfoList,
  ) => ButtonInfoList;
};

type Props = {
  readonly children: ReactNode;
};

export const InitialSettingDataContext =
  createContext<InitialSettingDataContextObject>(
    {} as InitialSettingDataContextObject,
  );

export const practiceQuestionFormat = {
  fiveChoices: {
    id: 'pqs_questionFormat_fiveChoices',
    value: 'fiveChoices',
    name: '五択',
  },
  fourChoices: {
    id: 'pqs_questionFormat_fourChoices',
    value: 'fourChoices',
    name: '四択',
  },
  qAndA: {
    id: 'pqs_questionFormat_qAndA',
    value: 'qAndA',
    name: '一問一答(〇✕)',
  },
} as const;
export type PracticeQuestionFormat =
  (typeof practiceQuestionFormat)[keyof typeof practiceQuestionFormat];
export const practiceQuestionOrder = {
  random: {id: 'pqs_questionOrder_random', value: 'random', name: 'ランダム'},
  inOrder: {
    id: 'pqs_questionOrder_inOrder',
    value: 'inOrder',
    name: '試験問題順',
  },
} as const;
export type PracticeQuestionOrder =
  (typeof practiceQuestionOrder)[keyof typeof practiceQuestionOrder];
export const practiceQuestionDifficulties = {
  one: {id: 'pqs_questionDifficulties_one', value: 'one', name: '☆'},
  two: {id: 'pqs_questionDifficulties_two', value: 'two', name: '☆☆'},
  three: {id: 'pqs_questionDifficulties_three', value: 'three', name: '☆☆☆'},
} as const;
export const practiceQuestionCoverage = {
  onlyWeakSpot: {
    id: 'pqs_questionCoverage_onlyWeakSpot',
    value: 'WeakSpot',
    name: '苦手問題のみ',
  },
  onlyUnanswered: {
    id: 'pqs_questionCoverage_onlyUnanswered',
    value: 'Unanswered',
    name: '未回答問題のみ',
  },
  bothUnCorrectlyAndWeakSpot: {
    id: 'pqs_questionCoverage_bothUnCorrectlyAndWeakSpot',
    value: 'WeakSpot&Unanswered',
    name: '苦手または未回答問題',
  },
  all: {id: 'pqs_questionCoverage_all', value: 'all', name: 'すべて出題'},
} as const;
export type PracticeQuestionCoverage =
  (typeof practiceQuestionCoverage)[keyof typeof practiceQuestionCoverage];
export const practiceQuestionOptions = {
  shuffleChoices: {
    id: 'pqs_questionOptions_shuffleChoices',
    value: 'shuffleChoices',
    name: '選択肢をシャッフル',
  },
} as const;
export type PracticeQuestionOptions =
  (typeof practiceQuestionOptions)[keyof typeof practiceQuestionOptions];
export const practiceQuestionNumberOfQuestions: Record<
  string,
  {id: string; value: number; name: string}
> = {
  /* first: {
		id: 'pqs_questionNumberOfQuestions_zero',
		value: 0,
		name: '選択してください',
	},
	five: {
		id: 'pqs_questionNumberOfQuestions_five',
		value: 5,
		name: '5問',
	},
	ten: {
		id: 'pqs_questionNumberOfQuestions_ten',
		value: 10,
		name: '10問',
	},
	twenty: {
		id: 'pqs_questionNumberOfQuestions_twenty',
		value: 20,
		name: '20問',
	},
	thirty: {
		id: 'pqs_questionNumberOfQuestions_thirty',
		value: 30,
		name: '30問',
	},
	forty: {
		id: 'pqs_questionNumberOfQuestions_forty',
		value: 40,
		name: '40問',
	},
	fifty: {
		id: 'pqs_questionNumberOfQuestions_fifty',
		value: 50,
		name: '50問',
	},
	infinite: {
		id: 'pqs_questionNumberOfQuestions_infinite',
		value: -1,
		name: '無制限',
	}, */
  input: {
    id: 'pqs_questionNumberOfQuestions_input_0',
    value: 0,
    name: '未入力',
  },
};
export type PracticeQuestionNumberOfQuestions =
  (typeof practiceQuestionNumberOfQuestions)[keyof typeof practiceQuestionNumberOfQuestions];
export const practiceQuestionTime = {
  /* first: {
		id: 'pqs_questionTime_0',
		value: 0,
		name: '選択してください',
	},
	five: {
		id: 'pqs_questionTime_5',
		value: 5,
		name: '5分',
	},
	ten: {
		id: 'pqs_questionTime_10',
		value: 10,
		name: '10分',
	},
	twelve: {
		id: 'pqs_questionTime_20',
		value: 20,
		name: '20分',
	},
	thirty: {
		id: 'pqs_questionTime_30',
		value: 30,
		name: '30分',
	},
	forty: {
		id: 'pqs_questionTime_40',
		value: 40,
		name: '40分',
	},
	fifty: {
		id: 'pqs_questionTime_50',
		value: 50,
		name: '50分',
	}, */
  infinite: {
    id: 'pqs_questionTime_infinite',
    value: -1,
    name: '無制限',
  },
  input: {
    id: 'pqs_questionTime_input',
    value: 0,
    name: '未入力',
  },
} as const;

/**
 * 初期設定データを提供するコンテキスト
 * @param props
 * @returns
 */
const InitialSettingDataContextProvider = (props: Props) => {
  const {grade} = useContext(GlobalUserSettingContext);
  /** 練習モードの初期設定 */
  const initialPracticeQuestionSetting: PracticeQuestionSettingType =
    useMemo(() => {
      return {
        questionCategory: [],
        qaaQuestionCategory: [],
        questionFormat: [
          grade === questionGrade.gradeTwo
            ? {
                ...practiceQuestionFormat.fiveChoices,
                initialState: CheckButtonStates.checked,
              }
            : {
                ...practiceQuestionFormat.fourChoices,
                initialState: CheckButtonStates.checked,
              },
          {
            ...practiceQuestionFormat.qAndA,
            initialState: CheckButtonStates.unchecked,
          },
        ],
        questionOrder: [
          {
            ...practiceQuestionOrder.inOrder,
            initialState: CheckButtonStates.checked,
          },
          {
            ...practiceQuestionOrder.random,
            initialState: CheckButtonStates.unchecked,
          },
        ],
        questionDifficulties: [
          {
            ...practiceQuestionDifficulties.one,
            initialState: CheckButtonStates.checked,
          },
          {
            ...practiceQuestionDifficulties.two,
            initialState: CheckButtonStates.checked,
          },
          {
            ...practiceQuestionDifficulties.three,
            initialState: CheckButtonStates.checked,
          },
        ],
        questionCoverage: [
          {
            ...practiceQuestionCoverage.onlyWeakSpot,
            initialState: CheckButtonStates.disabled,
          },
          {
            ...practiceQuestionCoverage.onlyUnanswered,
            initialState: CheckButtonStates.disabled,
          },
          {
            ...practiceQuestionCoverage.bothUnCorrectlyAndWeakSpot,
            initialState: CheckButtonStates.disabled,
          },
          {
            ...practiceQuestionCoverage.all,
            initialState: CheckButtonStates.checked,
          },
        ],
        option: [
          {
            ...practiceQuestionOptions.shuffleChoices,
            initialState: CheckButtonStates.checked,
          },
        ],
        numberOfQuestions: [
          /*
          {
            ...practiceQuestionNumberOfQuestions.first,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.five,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.ten,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.twenty,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.thirty,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.forty,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.fifty,
            initialState: CheckButtonStates.unchecked,
          },
          {
            ...practiceQuestionNumberOfQuestions.infinite,
            initialState: CheckButtonStates.unchecked,
          },
          */
          {
            ...practiceQuestionNumberOfQuestions.input,
            initialState: CheckButtonStates.unchecked,
          },
        ],
        questionTime: [
          /* {
						...practiceQuestionTime.first,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.one,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.five,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.ten,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.twelve,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.thirty,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.forty,
						initialState: CheckButtonStates.unchecked,
					},
					{
						...practiceQuestionTime.fifty,
						initialState: CheckButtonStates.unchecked,
					}, */
          {
            ...practiceQuestionTime.infinite,
            initialState: CheckButtonStates.checked,
          },
          {
            ...practiceQuestionTime.input,
            initialState: CheckButtonStates.unchecked,
          },
        ],
      };
    }, [grade]);
  /** 練習モードの初期設定id */
  const initialPracticeQuestionSettingId: PracticeQuestionSettingIdList =
    useMemo(() => {
      return {
        questionCategory: [],
        qaaQuestionCategory: [],
        questionFormat: [initialPracticeQuestionSetting.questionFormat[0].id],
        questionOrder: [initialPracticeQuestionSetting.questionOrder[0].id],
        questionDifficulties: [
          // チェックボックスは空のままにしないとチェックが外れなくなる
        ],
        questionCoverage: [
          initialPracticeQuestionSetting.questionCoverage[3].id,
        ],
        option: [],
        numberOfQuestions: [
          initialPracticeQuestionSetting.numberOfQuestions[0].id,
        ],
        questionTime: [initialPracticeQuestionSetting.questionTime[0].id],
      };
    }, [initialPracticeQuestionSetting]);

  /** 模擬試験モードの初期設定データ */
  const initialExamQuestionInfoList: Record<
    string,
    Record<string, ExamQuestionSettingInfoType>
  > = useMemo(() => {
    return {
      /* [questionGrade.gradeOne]: {
				subjectOne: {
					subjectName: '学科Ⅰ',
					categoryName: '計画',
					numberOfQuestions: 20,
					time: 60,
				},
				subjectTwo: {
					subjectName: '学科Ⅱ',
					categoryName: '環境・設備',
					numberOfQuestions: 20,
					time: 60,
				},
				subjectThree: {
					subjectName: '学科Ⅲ',
					categoryName: '法規',
					numberOfQuestions: 30,
					time: 105,
				},
				subjectFour: {
					subjectName: '学科Ⅳ',
					categoryName: '構造',
					numberOfQuestions: 30,
					time: 90,
				},
				subjectFive: {
					subjectName: '学科Ⅴ',
					categoryName: '施工',
					numberOfQuestions: 25,
					time: 75,
				},
			}, */
      /* [questionGrade.gradeTwo]: {
				subjectOne: {
					subjectName: '学科Ⅰ',
					categoryName: '建築計画',
					numberOfQuestions: 25,
					time: 90,
				},
				subjectTwo: {
					subjectName: '学科Ⅱ',
					categoryName: '建築法規',
					numberOfQuestions: 25,
					time: 90,
				},
				subjectThree: {
					subjectName: '学科Ⅲ',
					categoryName: '建築構造',
					numberOfQuestions: 25,
					time: 90,
				},
				subjectFour: {
					subjectName: '学科Ⅳ',
					categoryName: '建築施工',
					numberOfQuestions: 25,
					time: 90,
				},
			}, */
      [questionGrade.gradeOne]: {
        subjectOneTwo: {
          subjectName: '学科Ⅰ・学科Ⅱ',
          categoryName: '計画・環境・設備',
          numberOfQuestions: 40,
          time: 120,
        },
        subjectThree: {
          subjectName: '学科Ⅲ',
          categoryName: '法規',
          numberOfQuestions: 30,
          time: 105,
        },
        subjectFourFive: {
          subjectName: '学科Ⅳ・学科Ⅴ',
          categoryName: '構造・施工',
          numberOfQuestions: 55,
          time: 165,
        },
      },
      [questionGrade.gradeTwo]: {
        subjectOneTwo: {
          subjectName: '学科Ⅰ・学科Ⅱ',
          categoryName: '建築計画・建築法規',
          numberOfQuestions: 50,
          time: 180,
        },
        subjectThreeFour: {
          subjectName: '学科Ⅲ・学科Ⅳ',
          categoryName: '建築構造・建築施工',
          numberOfQuestions: 50,
          time: 180,
        },
      },
    };
  }, []);

  /** 模擬試験モードの初期設定ボタン情報：学科 */
  const initialExamSubjectButtonInfoList: ButtonInfoList = useMemo(() => {
    if (grade) {
      const subjectInfo = Object.values(initialExamQuestionInfoList[grade]);
      const keys = Object.keys(initialExamQuestionInfoList[grade]);
      return subjectInfo.map((v, i) => {
        return {
          id: `eqs_${grade}_${keys[i]}`,
          name: v.subjectName,
          initialState:
            i === 0 ? CheckButtonStates.checked : CheckButtonStates.unchecked,
          value: v.subjectName,
        };
      });
    }

    return [] as ButtonInfoList;
  }, [grade, initialExamQuestionInfoList]);

  /** 模擬試験モードのボタン情報を取得：問題数・時間 */
  const getExamNumberOfQuestionsButtonInfoList: (
    subject: string,
  ) => ButtonInfoList = useCallback(
    (subject: string) => {
      if (grade) {
        const subjectInfo = initialExamQuestionInfoList[grade][subject];
        return [
          {
            id: `eqs_${grade}_${subject}_NumberOfQuestions_full`,
            name: `${subjectInfo.numberOfQuestions}問 ${subjectInfo.time}分`,
            initialState: CheckButtonStates.checked,
            value: `${subjectInfo.numberOfQuestions}問_${subjectInfo.time}分`,
          },
          {
            id: `eqs_${grade}_${subject}_NumberOfQuestions_half`,
            name: `${Math.ceil(
              subjectInfo.numberOfQuestions / 2,
            )}問 ${Math.ceil(subjectInfo.time / 2)}分`,
            initialState: CheckButtonStates.unchecked,
            value: `${Math.ceil(
              subjectInfo.numberOfQuestions / 2,
            )}問_${Math.ceil(subjectInfo.time / 2)}分`,
          },
        ];
      }

      return [] as ButtonInfoList;
    },
    [grade, initialExamQuestionInfoList],
  );

  /** 模擬試験モードの初期設定Id */
  const initialExamQuestionSettingId: ExamQuestionSettingIdList =
    useMemo(() => {
      if (initialExamSubjectButtonInfoList.length > 0) {
        return {
          subject: [initialExamSubjectButtonInfoList[0].id],
          numberOfQuestions: [
            getExamNumberOfQuestionsButtonInfoList('subjectOneTwo')[0].id,
          ],
        };
      }

      return {
        subject: [],
        numberOfQuestions: [],
      };
    }, [
      initialExamSubjectButtonInfoList,
      getExamNumberOfQuestionsButtonInfoList,
    ]);

  /*
	useEffect(() => {
		console.log(initialExamSubjectButtonInfoList);
		console.log(initialExamQuestionSettingId);
	}, [initialExamQuestionSettingId, initialExamSubjectButtonInfoList]);
*/
  /** 選択したidからButtonInfoに変更 */
  const idToCheckedButtonInfoList = useCallback(
    (id: string, list: ButtonInfoList) => {
      return (
        list
          // .filter((button) => button.id === id)
          .filter((button) => button.id.includes(id)) // 問題数と制限時間のidに対応
          .map((button) => {
            return {
              ...button,
              initialState: CheckButtonStates.checked,
            };
          }) as ButtonInfoList
      );
    },
    [],
  );
  /**  idListをButtonInfoListに変換 */
  const idListToCheckedButtonList = useCallback(
    (idList: string[], list: ButtonInfoList) => {
      return list
        .filter((button) => idList.includes(button.id))
        .map((button) => {
          return {...button, initialState: CheckButtonStates.checked};
        });
    },
    [],
  );

  const value = useMemo(() => {
    return {
      initialPracticeQuestionSetting,
      initialPracticeQuestionSettingId,
      initialExamQuestionInfoList,
      initialExamSubjectButtonInfoList,
      initialExamQuestionSettingId,
      getExamNumberOfQuestionsButtonInfoList,
      idToCheckedButtonInfoList,
      idListToCheckedButtonList,
    };
  }, [
    initialPracticeQuestionSetting,
    initialPracticeQuestionSettingId,
    initialExamQuestionInfoList,
    initialExamSubjectButtonInfoList,
    initialExamQuestionSettingId,
    getExamNumberOfQuestionsButtonInfoList,
    idToCheckedButtonInfoList,
    idListToCheckedButtonList,
  ]);

  return (
    <InitialSettingDataContext.Provider value={value}>
      {props.children}
    </InitialSettingDataContext.Provider>
  );
};

export default InitialSettingDataContextProvider;

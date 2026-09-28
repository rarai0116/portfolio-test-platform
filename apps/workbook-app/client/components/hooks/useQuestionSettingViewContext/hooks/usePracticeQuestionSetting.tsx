import {summarizeConsoleValue} from '../../../functionals/consoleLevels';
import type React from 'react';
import {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {logErrorToAnalytics} from '@functionals/analyticsController';
import {
  CheckButtonStates,
  useCheckedButtonList,
  type ButtonInfoList,
} from '../../useCheckButtonContext';
import {
  type QuestionModeType,
  type QuestionSettingStateType,
  type QuestionSubjectType,
  questionMode,
  questionSettingState,
  type QuestionCoverageType,
  questionCoverage,
} from '../../../../types/commonUnionType';
import {GlobalUserSettingContext} from '../../useGlobalUserSettingContext';
import {generateTestDataId} from '../../../functionals/testDataController';
import {
  InitialSettingDataContext,
  practiceQuestionFormat,
} from '../../useInitialSettingDataContext';
import {
  GlobalSaveDataContext,
  type SettingCardData,
  type TestData,
} from '../../useGlobalSaveDataContext';
import {
  getCategoryCheckBoxInfoList,
  getEachCategoryNumberOfQuestions,
} from '../../../functionals/getCategoryCheckBoxInfoList';

export type PracticeSettingKey =
  | 'questionFormat'
  | 'questionOrder'
  | 'questionDifficulties'
  | 'questionCoverage'
  | 'option'
  | 'numberOfQuestions'
  | 'questionTime'
  | 'questionCategory'
  | 'qaaQuestionCategory';

export type PracticeQuestionSettingType = Record<
  PracticeSettingKey,
  ButtonInfoList
>;
export type PracticeQuestionSettingIdList = Record<
  PracticeSettingKey,
  string[]
>;
export type PracticeQuestionSettingOtherTypedIdList = Record<
  PracticeSettingKey,
  string[]
>;

export type QuestionButtonSettingInfo = {
  buttonList: ButtonInfoList;
  checkedList: ButtonInfoList;
  setCheckedList: React.Dispatch<React.SetStateAction<ButtonInfoList>>;
  buttonIdList: string[];
  checkedIdList: string[];
  label: string;
};
type QuestionSelectBoxInfo = {
  selectedValue: string;
  setSelectedValue: React.Dispatch<React.SetStateAction<string[]>>;
  inputId: string;
  label: string;
};
type QuesstionButtonWithSelectBoxInfo = QuestionButtonSettingInfo & {
  formattedId: string;
  initialValue: string | null;
  setSelectedValue: React.Dispatch<React.SetStateAction<string | null>>;
  selectedValue: string | null;
  inputNo: number;
  label: string;
};
type QuestionCategoryInfo = {
  buttonList: ButtonInfoList;
  buttonIdList: string[];
};

export type PracticeQuestionSetting = {
  getTargetQuestionSettingId: (
    _modeType: QuestionModeType,
    _settingState: QuestionSettingStateType,
  ) => PracticeQuestionSettingIdList;
  // 練習モードボタンリスト
  questionOrderInfo: QuestionButtonSettingInfo;
  questionCoverageInfo: QuestionButtonSettingInfo;
  questionDifficultiesInfo: QuestionButtonSettingInfo;
  questionTimeInfo: QuesstionButtonWithSelectBoxInfo;
  questionOptionInfo: QuestionButtonSettingInfo;
  questionFormatInfo: QuestionButtonSettingInfo;
  questionNumberOfQuestionsInfo: QuestionSelectBoxInfo;
  //  questionQaaCategoryInfo: QuestionButtonSettingInfo;
  initializeQuestionInfo: () => void;
  initializeCategoryCheckList: (id?: string) => void;
  getPracticeOtherSettingString: (
    list: PracticeQuestionSettingIdList,
  ) => string;
  maxNumberOfQuestion: number;

  categorySubject: QuestionSubjectType | undefined;
  setCategorySubject: (subject: QuestionSubjectType | undefined) => void;
  isCurrentSelectedQaa: boolean;
  currentSelectedPracticeSettingIdList: PracticeQuestionSettingIdList;
  //  selectedQuestionCategoryInfo: QuestionButtonSettingInfo;
  getSettedTargetingTestData: (
    _isQaa?: boolean,
    _currentSelectedPracticeSettingIdList?: PracticeQuestionSettingIdList,
  ) => TestData[];
  testDataList: TestData[];
  qualifiedQuestionCount: number;
  requiredQuestionCount: number;
  setQualifiedQuestionCount: React.Dispatch<React.SetStateAction<number>>;
  setRequiredQuestionCount: React.Dispatch<React.SetStateAction<number>>;
  isPracticeQuestionStartReserved: boolean;
  setIsPracticeQuestionStartReserved: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  /**
   * 任意のPracticeQuestionSettingIdListをもとにQuestionInfoを設定する
   */
  setQuestionInfosByCardData: (card: SettingCardData) => void;
  questionCategoryCommonButtonList: QuestionCategoryInfo;
  checkedCategoryButtonInfoList: ButtonInfoList;
  setCheckedCategoryButtonInfoList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  checkedCategoryButtonIdList: string[];
  questionCountMap: Record<string, number>;
  getQuestionNameWithCount: (targetButtonInfoList: ButtonInfoList) => Array<{
    name: string;
    id: string;
  }>;
}; // & DataAnalysisQuestionSetting;

const updateQuestionButtonList: ({
  initialButtonList,
  targetButtonId,
  isCalledSaved,
}: {
  initialButtonList: ButtonInfoList;
  targetButtonId: string[];
  isCalledSaved: boolean;
}) => {
  buttonList: ButtonInfoList;
  buttonIdList: string[];
} = ({initialButtonList, targetButtonId, isCalledSaved: _isCalledSaved}) => {
  const buttonList = initialButtonList.map((buttonInfo, _i) => {
    if (targetButtonId.includes(buttonInfo.id)) {
      /* if (isCalledSaved)
        return {...buttonInfo, initialState: CheckButtonStates.disabledChecked}; */
      return {...buttonInfo, initialState: CheckButtonStates.checked};
    } /* else {
      if (isCalledSaved)
        return {...buttonInfo, initialState: CheckButtonStates.disabled}; */

    return buttonInfo;
    /* } */
  });
  const buttonIdList = buttonList.map((v) => v.id);
  // console.log('buttonList', buttonList);
  // console.log('buttonIdList', buttonIdList);
  return {
    buttonList,
    buttonIdList,
  };
};

const _createQuestionCategoryInfo: ({
  initialButtonList,
  targetButtonId,
  isCalled,
}: {
  initialButtonList: ButtonInfoList;
  targetButtonId: string[];
  isCalled: boolean;
}) => QuestionCategoryInfo = ({
  initialButtonList,
  targetButtonId,
  isCalled: _isCalled,
}) => {
  const buttonList = initialButtonList.map((buttonInfo, _i) => {
    if (targetButtonId.includes(buttonInfo.id)) {
      /* if (isCalled)
        return {...buttonInfo, initialState: CheckButtonStates.disabledChecked}; */
      return {...buttonInfo, initialState: CheckButtonStates.checked};
    } /* else {
      if (isCalled)
        return {...buttonInfo, initialState: CheckButtonStates.disabled}; */

    return buttonInfo;
    /* } */
  });
  const buttonIdList = buttonList.map((v) => v.id);
  return {
    buttonList,
    buttonIdList,
  };
};

const usePracticeQuestionSetting: (props: {
  id: string;
  currentSetting: {
    currentSettingId: string;
    settingState: QuestionSettingStateType;
    questionModeType: QuestionModeType;
    isCalledSaved: boolean;
  };
}) => PracticeQuestionSetting = (props) => {
  /** Props */
  const {currentSetting} = props;
  const {currentSettingId, settingState, questionModeType, isCalledSaved} =
    currentSetting;

  /** Load Context */
  const {testIdList} = useContext(GlobalUserSettingContext);

  const {
    initialPracticeQuestionSetting,
    initialPracticeQuestionSettingId,
    idToCheckedButtonInfoList,
    idListToCheckedButtonList,
  } = useContext(InitialSettingDataContext);

  const {
    previousSavedSetting,
    answerlingTestSettingData,
    savedSettingList,
    getTestDataList,
    //    getCategoryData,
    getCategoryDataLengthMap,
    categoryDataLengthMap,
  } = useContext(GlobalSaveDataContext);

  /*
  const dataAnalysisQuestionSetting = useDataAnalysisQuestionSetting();
  const {
    dataAnalysisQuestionSettingState,
    setDataAnalysisQuestionSettingState,
    initialDataAnalysisQuestionSettingIdList,
    modifyDataAnalysisQuestionSettingIdList,
  } = dataAnalysisQuestionSetting;
  */

  /** Define States */
  const [numberOfQuestionsSelected, setNumberOfQuestionsSelected] = useState<
    string[]
  >(['0']);
  const [questionTimeSelected, setQuestionTimeSelected] = useState<
    string | null
  >(null);
  // 設定した問題数
  const [requiredQuestionCount, setRequiredQuestionCount] = useState(0);
  // 条件に合った問題数
  const [qualifiedQuestionCount, setQualifiedQuestionCount] = useState(0);
  // 練習問題演習開始予約フラグ
  const [isPracticeQuestionStartReserved, setIsPracticeQuestionStartReserved] =
    useState(false);

  /** Load CheckButtonList */
  const [
    questionCoverageCheckedButtonList,
    setQuestionCoverageCheckedButtonList,
  ] = useCheckedButtonList(initialPracticeQuestionSetting.questionCoverage);
  const [questionOrderCheckedButtonList, setQuestionOrderCheckedButtonList] =
    useCheckedButtonList(initialPracticeQuestionSetting.questionOrder);
  const [
    questionDifficultiesCheckedButtonList,
    setQuestionDifficultiesCheckedButtonList,
  ] = useCheckedButtonList(initialPracticeQuestionSetting.questionDifficulties);
  const [questionTimeCheckedButtonList, setQuestionTimeCheckedButtonList] =
    useCheckedButtonList(initialPracticeQuestionSetting.questionTime);
  const [questionFormatCheckedButtonList, setQuestionFormatCheckedButtonList] =
    useCheckedButtonList(initialPracticeQuestionSetting.questionFormat);
  const [optionCheckedButtonList, setOptionCheckedButtonList] =
    useCheckedButtonList(initialPracticeQuestionSetting.option);
  const [checkedCategoryButtonInfoList, setCheckedCategoryButtonInfoList] =
    useCheckedButtonList(initialPracticeQuestionSetting.questionCategory);
  const [
    _checkedQaaCategoryButtonInfoList,
    _setCheckedQaaCategoryButtonInfoList,
  ] = useCheckedButtonList(initialPracticeQuestionSetting.qaaQuestionCategory);

  /** Defined Memos */
  const [
    answeredTestIdList,
    weakPointTestIdList,
    //    weakPointOrUnAnsweredTestIdList,
  ] = useMemo(
    () => [
      testIdList.answered.total,
      testIdList.weakPoint.total,
      //    testIdList.weakPointOrUnAnsweredTest.total,
    ],
    [testIdList.answered.total, testIdList.weakPoint.total],
  );

  const [categorySubject, _setCategorySubject] = useState<
    QuestionSubjectType | undefined
  >(undefined);
  const setCategorySubject = useCallback(
    (subject: QuestionSubjectType | undefined) => {
      if (checkedCategoryButtonInfoList.length > 0) {
        if (subject) {
          setCheckedCategoryButtonInfoList((previous) =>
            previous.filter((v) => v.id.includes(subject)),
          );
        } else {
          setCheckedCategoryButtonInfoList([]);
        }
      }

      /*
      if (checkedQaaCategoryButtonInfoList.length > 0) {
        if (subject) {
          setCheckedQaaCategoryButtonInfoList((previous) =>
            previous.filter((v) => v.id.includes(subject)),
          );
        } else {
          setCheckedQaaCategoryButtonInfoList([]);
        }
      }
      */

      _setCategorySubject(subject);
    },
    [checkedCategoryButtonInfoList, setCheckedCategoryButtonInfoList],
  );

  /** 練習モードの設定id */
  // InitialSettingDataとマージする対象のSettingID
  // 呼び出しているセーブデータごとに適切な設定を返す
  const getTargetQuestionSettingId = useCallback(
    (_modeType: QuestionModeType, _settingState: QuestionSettingStateType) => {
      // 保存した設定・課題の場合
      if (
        _modeType === questionMode.practice &&
        currentSettingId !== undefined
      ) {
        // 保存した設定or課題から呼び出した場合
        if (
          _settingState === questionSettingState.saved ||
          _settingState === questionSettingState.task
        ) {
          const setting = savedSettingList?.[currentSettingId]?.taskSetting;
          if (!setting?.hasTask) {
            return initialPracticeQuestionSettingId;
          }

          return savedSettingList[currentSettingId].practiceQuestionSetting;
        }

        // 前回の設定から呼び出した場合
        if (
          _settingState === questionSettingState.previous &&
          previousSavedSetting !== null
        ) {
          return previousSavedSetting.practiceQuestionSetting;
        }

        // 中断した設定から呼び出した場合
        if (
          answerlingTestSettingData !== null &&
          _settingState === questionSettingState.interrupted &&
          answerlingTestSettingData.settingCardData.id === currentSettingId
        ) {
          return answerlingTestSettingData.settingCardData
            .practiceQuestionSetting;
        }

        // カテゴリー分析から呼び出した場合

        /*
        if (_settingState === questionSettingState.categoryDataAnalysis) {
          return initialDataAnalysisQuestionSettingIdList;
        }
          */
      }

      // 初期設定の場合
      return initialPracticeQuestionSettingId;
    },
    [
      currentSettingId,
      answerlingTestSettingData,
      previousSavedSetting,
      savedSettingList,
      initialPracticeQuestionSettingId,
      // initialDataAnalysisQuestionSettingIdList,
    ],
  );

  /**
   * 各種練習モード設定の構造体
   */
  // 出題形式
  const getQuestionOrderButtonList = useCallback(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    return updateQuestionButtonList({
      initialButtonList: initialPracticeQuestionSetting.questionOrder,
      targetButtonId: targetQuestionSettingId.questionOrder,
      isCalledSaved,
    });
  }, [
    initialPracticeQuestionSetting,
    settingState,
    questionModeType,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);
  const questionOrderInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionOrderInfo');
    return {
      ...getQuestionOrderButtonList(),
      checkedList: questionOrderCheckedButtonList,
      checkedIdList: questionOrderCheckedButtonList.map((v) => v.id),
      setCheckedList: setQuestionOrderCheckedButtonList,
      label: questionOrderCheckedButtonList[0]?.name ?? '',
    };
  }, [
    getQuestionOrderButtonList,
    questionOrderCheckedButtonList,
    setQuestionOrderCheckedButtonList,
  ]);

  // 難易度
  const getQuestionDifficultiesButtonList = useCallback(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    return updateQuestionButtonList({
      initialButtonList: initialPracticeQuestionSetting.questionDifficulties,
      targetButtonId: targetQuestionSettingId.questionDifficulties,
      isCalledSaved,
    });
  }, [
    initialPracticeQuestionSetting,
    questionModeType,
    settingState,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);
  const questionDifficultiesInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionDifficultiesInfo');
    return {
      ...getQuestionDifficultiesButtonList(),
      checkedList: questionDifficultiesCheckedButtonList,
      setCheckedList: setQuestionDifficultiesCheckedButtonList,
      checkedIdList: questionDifficultiesCheckedButtonList.map((v) => v.id),
      label: questionDifficultiesCheckedButtonList
        .map((v) => {
          return v.name;
        })
        .join('/'),
    };
  }, [
    getQuestionDifficultiesButtonList,
    questionDifficultiesCheckedButtonList,
    setQuestionDifficultiesCheckedButtonList,
  ]);

  // 問題時間
  const getQuestionTimeButtonList = useCallback(() => {
    const pattern = /(pqs_.+_.+)_(\d+)/g;
    const initialButtonInfo = initialPracticeQuestionSetting.questionTime.map(
      (v) => {
        return {...v, id: v.id.replaceAll(pattern, '$1')};
      },
    );
    // console.log('initialButtonInfo', initialButtonInfo);
    // console.log(questionModeType, settingState);
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );

    const preTargetButtonId = targetQuestionSettingId.questionTime.map((v) => {
      return v.replaceAll(pattern, '$1');
    });
    // 保存データに数値が入力されている場合は、initialValueに入力された数値を入れる
    const targetButtonId = [
      preTargetButtonId[0] === initialPracticeQuestionSettingId.questionTime[0]
        ? preTargetButtonId[0]
        : initialPracticeQuestionSettingId.questionTime[1],
    ];
    // console.log('targetButtonId', targetButtonId);
    const initialValue = (() => {
      if (
        targetButtonId[0] === initialPracticeQuestionSettingId.questionTime[0]
      )
        return null;
      if (!targetQuestionSettingId.questionTime[0]) return null;
      return targetQuestionSettingId.questionTime[0].replaceAll(pattern, '$2');
    })();
    // console.log('initialValue', initialValue);

    return {
      initialValue,
      ...updateQuestionButtonList({
        initialButtonList: initialButtonInfo,
        targetButtonId,
        isCalledSaved,
      }),
    };
  }, [
    initialPracticeQuestionSetting,
    initialPracticeQuestionSettingId,
    questionModeType,
    settingState,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const questionTimeInfo: QuesstionButtonWithSelectBoxInfo = useMemo(() => {
    console.log('update questionTimeInfo'); // , questionTimeCheckedButtonList[0]);
    const checkedIdList = questionTimeCheckedButtonList.map((v) => v.id);
    const buttonListData = getQuestionTimeButtonList();
    const inputNo = (() => {
      if (questionTimeCheckedButtonList.length === 0) return 0;
      if (questionTimeCheckedButtonList[0].name === '無制限') return -1;
      if (questionTimeSelected) {
        if (questionTimeSelected === '') return 0;
        return Number(questionTimeSelected);
      }

      if (buttonListData.initialValue)
        return Number(buttonListData.initialValue);
      return 0;
    })();
    const formattedId = (() => {
      if (inputNo < 0) return questionTimeCheckedButtonList[0].id;
      return `pqs_questionTime_input_${inputNo}`;
    })();
    // console.log('initialValue', buttonListData.initialValue);
    // console.log('questionTimeSelected', questionTimeSelected);
    // console.log('inputNo', inputNo);
    // console.log('formattedId', formattedId);

    if (inputNo > 0 && Number(questionTimeSelected) !== inputNo) {
      setQuestionTimeSelected(`${inputNo}`);
    }

    return {
      ...buttonListData,
      checkedList: questionTimeCheckedButtonList,
      setCheckedList: setQuestionTimeCheckedButtonList,
      checkedIdList,
      selectedValue: questionTimeSelected,
      inputNo,
      setSelectedValue: setQuestionTimeSelected,
      formattedId,
      label: inputNo < 0 ? '無制限' : `${inputNo}分`,
    };
  }, [
    getQuestionTimeButtonList,
    questionTimeCheckedButtonList,
    questionTimeSelected,
    setQuestionTimeCheckedButtonList,
    setQuestionTimeSelected,
  ]);

  // オプション
  const getOptionButtonList = useCallback(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    return updateQuestionButtonList({
      initialButtonList: initialPracticeQuestionSetting.option,
      targetButtonId: targetQuestionSettingId.option,
      isCalledSaved,
    });
  }, [
    initialPracticeQuestionSetting.option,
    settingState,
    questionModeType,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);
  const questionOptionInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionOptionInfo');
    return {
      ...getOptionButtonList(),
      checkedList: optionCheckedButtonList,
      setCheckedList: setOptionCheckedButtonList,
      checkedIdList: optionCheckedButtonList.map((v) => v.id),
      label:
        optionCheckedButtonList.map((v) => v.id)[0] ===
        initialPracticeQuestionSetting.option[0].id
          ? '選択肢をシャッフル'
          : 'なし',
    };
  }, [
    getOptionButtonList,
    optionCheckedButtonList,
    setOptionCheckedButtonList,
    initialPracticeQuestionSetting.option,
  ]);

  // 問題形式
  const getQuestionFormatButtonList = useCallback(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    return updateQuestionButtonList({
      initialButtonList: initialPracticeQuestionSetting.questionFormat,
      targetButtonId: targetQuestionSettingId.questionFormat,
      isCalledSaved,
    });
  }, [
    initialPracticeQuestionSetting.questionFormat,
    settingState,
    questionModeType,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);

  const questionFormatInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionFormatInfo');
    return {
      ...getQuestionFormatButtonList(),
      checkedList: questionFormatCheckedButtonList,
      setCheckedList: setQuestionFormatCheckedButtonList,
      checkedIdList: questionFormatCheckedButtonList.map((v) => v.id),
      label: questionFormatCheckedButtonList[0]?.name ?? '',
    };
  }, [
    getQuestionFormatButtonList,
    questionFormatCheckedButtonList,
    setQuestionFormatCheckedButtonList,
  ]);

  // 一問一答を選択しているかどうか
  const isCurrentSelectedQaa = useMemo(() => {
    return (
      questionFormatInfo.checkedIdList[0] ===
      initialPracticeQuestionSetting.questionFormat[1].id
    );
  }, [questionFormatInfo, initialPracticeQuestionSetting]);

  // テストデータリスト(問題形式によってスイッチする)
  const testDataList = useMemo(() => {
    return getTestDataList(isCurrentSelectedQaa);
  }, [getTestDataList, isCurrentSelectedQaa]);

  // 出題対象問題
  const getQuestionCoverageButtonList = useCallback(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    const buttonList = initialPracticeQuestionSetting.questionCoverage.map(
      (v, _i) => {
        const getIdList = (idList: string[]) =>
          idList.filter((id) => {
            // 一問一答モードの場合、idの先頭がqaaで始まる場合にtrue
            if (isCurrentSelectedQaa) return id.startsWith('qaa');
            // 選択肢モードの場合、idの先頭がch_で始まる場合にtrue
            return id.startsWith('ch_');
          });
        if (v.value === 'all') {
          return {...v, initialState: CheckButtonStates.checked};
        }

        if (
          v.value === 'WeakSpot' &&
          getIdList(testIdList.weakPoint.total).length > 0
        ) {
          return {...v, initialState: CheckButtonStates.unchecked};
        }

        if (
          v.value === 'Unanswered' &&
          testDataList.length > getIdList(testIdList.answered.total).length
        ) {
          return {...v, initialState: CheckButtonStates.unchecked};
        }

        if (
          v.value === 'WeakSpot&Unanswered' &&
          (getIdList(testIdList.weakPoint.total).length > 0 ||
            testDataList.length > getIdList(testIdList.answered.total).length)
        ) {
          return {...v, initialState: CheckButtonStates.unchecked};
        }

        return {...v, initialState: CheckButtonStates.disabled};
      },
    );
    return updateQuestionButtonList({
      initialButtonList: buttonList,
      targetButtonId: targetQuestionSettingId.questionCoverage,
      isCalledSaved,
    });
  }, [
    initialPracticeQuestionSetting.questionCoverage,
    questionModeType,
    settingState,
    testIdList,
    testDataList,
    isCurrentSelectedQaa,
    isCalledSaved,
    getTargetQuestionSettingId,
  ]);

  const questionCoverageInfo: QuestionButtonSettingInfo & {
    checkedType: QuestionCoverageType;
  } = useMemo(() => {
    console.log(
      'update questionCoverageInfo',
      summarizeConsoleValue(questionCoverageCheckedButtonList),
    );
    return {
      ...getQuestionCoverageButtonList(),
      checkedList: questionCoverageCheckedButtonList,
      setCheckedList: setQuestionCoverageCheckedButtonList,
      checkedIdList: questionCoverageCheckedButtonList.map((v) => v.id),
      label: questionCoverageCheckedButtonList[0]?.name ?? '',
      checkedType: (() => {
        if (questionCoverageCheckedButtonList.length === 0)
          return questionCoverage.all;
        if (questionCoverageCheckedButtonList[0].value === 'WeakSpot')
          return questionCoverage.onlyWeakSpot;
        if (questionCoverageCheckedButtonList[0].value === 'Unanswered')
          return questionCoverage.onlyUnanswered;
        if (
          questionCoverageCheckedButtonList[0].value === 'WeakSpot&Unanswered'
        )
          return questionCoverage.bothUnCorrectlyAndWeakSpot;
        return questionCoverage.all;
      })(),
    };
  }, [
    getQuestionCoverageButtonList,
    questionCoverageCheckedButtonList,
    setQuestionCoverageCheckedButtonList,
  ]);

  // 問題数
  const questionNumberOfQuestionsInfo: QuestionSelectBoxInfo = useMemo(() => {
    const number =
      numberOfQuestionsSelected[0] === '' ? '0' : numberOfQuestionsSelected[0];
    const inputId = (() => {
      const id = initialPracticeQuestionSetting.numberOfQuestions[0].id.replace(
        /\d+$/,
        number,
      );
      // console.log('id:', id);
      return id;
    })();

    return {
      selectedValue: numberOfQuestionsSelected[0],
      setSelectedValue: setNumberOfQuestionsSelected,
      inputId,
      label: `${number}問`,
    };
  }, [
    numberOfQuestionsSelected,
    initialPracticeQuestionSetting.numberOfQuestions,
  ]);

  // カテゴリ(四択)
  /*
  const questionCategoryCheckBoxInfoList = useCallback(() => {
    //    const categoryData = getCategoryData(false);
    const categoryDataLengthMap = getCategoryDataLengthMap(false);
    console.log(
      'update questionCategoryCheckBoxInfoList',
      //      categoryData,
      categoryDataLengthMap,
      questionCoverageInfo.checkedType,
      questionDifficultiesInfo.checkedList,
    );
    return getCategoryCheckBoxInfoList(
      //      categoryData ?? {},
      categoryDataLengthMap,
      questionCoverageInfo.checkedType,
      questionDifficultiesInfo.checkedList,
    );
  }, [
    //    getCategoryData,
    getCategoryDataLengthMap,
    questionCoverageInfo.checkedType,
    questionDifficultiesInfo.checkedList,
  ]);
  */

  /*
  const questionCategoryButtonList = useMemo(() => {
    const initialButtonList = questionCategoryCheckBoxInfoList();
    console.log('⭐️⭐️⭐️initialButtonList', initialButtonList);
    return initialButtonList;
  }, [questionCategoryCheckBoxInfoList]);
  */

  const questionCategoryCommonButtonList: QuestionCategoryInfo = useMemo(() => {
    // buttonInfoListを初期状態(すべて出題)で取得
    const buttonList = getCategoryCheckBoxInfoList(
      //      categoryData ?? {},
      categoryDataLengthMap,
      'すべて出題',
      [],
    );
    const buttonIdList = buttonList.map((v) => v.id);

    return {
      buttonList,
      buttonIdList,
    };
  }, [categoryDataLengthMap]);

  /*
  const questionCategoryButtonList: QuestionCategoryInfo = useMemo(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );
    const initialButtonList = questionCategoryCheckBoxInfoList();
    console.log('⭐️⭐️⭐️initialButtonList', initialButtonList);

    return createQuestionCategoryInfo({
      initialButtonList,
      targetButtonId: targetQuestionSettingId.questionCategory,
      isCalled:
        isCalledSaved ||
        settingState === questionSettingState.categoryDataAnalysis,
    });
  }, [
    settingState,
    questionModeType,
    isCalledSaved,
    questionCategoryCheckBoxInfoList,
    getTargetQuestionSettingId,
  ]);
  */
  const checkedCategoryButtonIdList = useMemo(() => {
    return checkedCategoryButtonInfoList.map((v) => v.id);
  }, [checkedCategoryButtonInfoList]);
  // ボタンidごとの問題数
  const questionCountMap = useMemo(() => {
    console.log(
      'update questionCountMap',
      summarizeConsoleValue(questionCategoryCommonButtonList.buttonIdList),
    );
    const _categoryDataLengthMap =
      getCategoryDataLengthMap(isCurrentSelectedQaa);
    return questionCategoryCommonButtonList.buttonIdList.reduce<
      Record<string, number>
    >((acc, id) => {
      const id2 = id.replace(/^[^-]*-/, '');
      const cell = _categoryDataLengthMap[id2];
      if (!cell) return acc;
      acc[id] = getEachCategoryNumberOfQuestions(
        cell,
        questionCoverageInfo.checkedType,
        questionDifficultiesInfo.checkedList,
      );
      return acc;
    }, {});
  }, [
    questionCategoryCommonButtonList.buttonIdList,
    questionCoverageInfo.checkedType,
    questionDifficultiesInfo.checkedList,
    isCurrentSelectedQaa,
    getCategoryDataLengthMap,
  ]);
  const getQuestionNameWithCount = useCallback(
    (targetButtonInfoList: ButtonInfoList) => {
      return targetButtonInfoList.map((v) => {
        const length = questionCountMap[v.id] || 0;
        return {
          name: `${v.name}(${length})`,
          id: v.id,
        };
      });
    },
    [questionCountMap],
  );

  /*
  const questionCategoryLabel = useMemo(() => {
    return getCheckedCategoryString(
      checkedCategoryButtonInfoList.map((v) => v.id),
      questionMode.practice,
      questionCategoryCommonButtonList.buttonList,
    );
  }, [checkedCategoryButtonInfoList, questionCategoryCommonButtonList]);

  const questionCategoryInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionCategoryInfo');
    return {
      ...questionCategoryButtonList,
      checkedList: checkedCategoryButtonInfoList,
      setCheckedList: setCheckedCategoryButtonInfoList,
      checkedIdList: checkedCategoryButtonInfoList.map((v) => v.id),
      label: questionCategoryLabel,
    };
  }, [
    questionCategoryButtonList,
    checkedCategoryButtonInfoList,
    setCheckedCategoryButtonInfoList,
    questionCategoryLabel,
  ]);
  */

  // カテゴリ(一問一答)

  /*
  const questionQaaCategoryCheckBoxInfoList = useCallback(() => {
    //    const categoryData = getCategoryData(true);
    const categoryDataLengthMap = getCategoryDataLengthMap(true);
    console.log(
      'update questionQaaCategoryCheckBoxInfoList',
      //      categoryData,
      categoryDataLengthMap,
      questionCoverageInfo.checkedType,
      questionDifficultiesInfo.checkedList,
    );
    return getCategoryCheckBoxInfoList(
      //     categoryData ?? {},
      categoryDataLengthMap,
      questionCoverageInfo.checkedType,
      questionDifficultiesInfo.checkedList,
    );
  }, [
    //    getCategoryData,
    getCategoryDataLengthMap,
    questionCoverageInfo.checkedType,
    questionDifficultiesInfo.checkedList,
  ]);
  const questionQaaCategoryButtonList: QuestionCategoryInfo = useMemo(() => {
    const targetQuestionSettingId = getTargetQuestionSettingId(
      questionModeType,
      settingState,
    );

    return createQuestionCategoryInfo({
      initialButtonList: questionQaaCategoryCheckBoxInfoList(),
      targetButtonId: targetQuestionSettingId.qaaQuestionCategory,
      isCalled:
        isCalledSaved ||
        settingState === questionSettingState.categoryDataAnalysis,
    });
  }, [
    settingState,
    questionModeType,
    isCalledSaved,
    questionQaaCategoryCheckBoxInfoList,
    getTargetQuestionSettingId,
  ]);
  const questionQaaCategoryLabel = useMemo(() => {
    return getCheckedCategoryString(
      checkedQaaCategoryButtonInfoList.map((v) => v.id),
      questionMode.practice,
      //      getCategoryData(true),
      questionCategoryCommonButtonList.buttonList,
    );
  }, [checkedQaaCategoryButtonInfoList, questionCategoryCommonButtonList]);

  const questionQaaCategoryInfo: QuestionButtonSettingInfo = useMemo(() => {
    console.log('update questionQaaCategoryInfo');
    return {
      ...questionQaaCategoryButtonList,
      checkedList: checkedQaaCategoryButtonInfoList,
      setCheckedList: setCheckedQaaCategoryButtonInfoList,
      checkedIdList: checkedQaaCategoryButtonInfoList.map((v) => v.id),
      label: questionQaaCategoryLabel,
    };
  }, [
    questionQaaCategoryButtonList,
    checkedQaaCategoryButtonInfoList,
    setCheckedQaaCategoryButtonInfoList,
    questionQaaCategoryLabel,
  ]);
  */

  // QuestionInfoのチェック状態を初期化
  const initializeQuestionInfo = useCallback(() => {
    setCheckedCategoryButtonInfoList([]);
    // questionCategoryInfo.setCheckedList([]);
    //    questionQaaCategoryInfo.setCheckedList([]);
    questionFormatInfo.setCheckedList(
      questionFormatInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionOrderInfo.setCheckedList(
      questionOrderInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionDifficultiesInfo.setCheckedList(
      questionDifficultiesInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionCoverageInfo.setCheckedList(
      questionCoverageInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionOptionInfo.setCheckedList(
      questionOptionInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionNumberOfQuestionsInfo.setSelectedValue([
      String(initialPracticeQuestionSetting.numberOfQuestions[0].value ?? 0),
    ]);
    questionTimeInfo.setCheckedList(
      questionTimeInfo.buttonList.filter((v) => {
        return (
          v.initialState === CheckButtonStates.checked ||
          v.initialState === CheckButtonStates.disabledChecked
        );
      }),
    );
    questionTimeInfo.setSelectedValue(null);
  }, [
    //    questionCategoryInfo,
    questionFormatInfo,
    questionOrderInfo,
    questionDifficultiesInfo,
    questionCoverageInfo,
    questionOptionInfo,
    questionNumberOfQuestionsInfo,
    questionTimeInfo,
    initialPracticeQuestionSetting,
    setCheckedCategoryButtonInfoList,
  ]);

  // 出題形式が変更されたときにカテゴリーInfoのチェック状態を初期化(両方にidが入るのを防ぐ)
  const initializeCategoryCheckList = useCallback(
    (id?: string) => {
      console.info('initializeCategoryCheckList');
      // 選択肢モードを選んだ場合は、シャッフルにチェックを入れる
      if (id === initialPracticeQuestionSetting.questionFormat[0].id) {
        questionOptionInfo.setCheckedList([
          initialPracticeQuestionSetting.option[0],
        ]);
        // 一問一答を選んだ場合は、選択肢をシャッフルのチェックを外す
      } else if (id === initialPracticeQuestionSetting.questionFormat[1].id) {
        questionOptionInfo.setCheckedList([]);
      }

      if (checkedCategoryButtonIdList.length > 0) {
        setCheckedCategoryButtonInfoList([]);
      }
      /*
      if (questionCategoryInfo.checkedIdList.length > 0) {
        questionCategoryInfo.setCheckedList([]);
      } else if (questionQaaCategoryInfo.checkedIdList.length > 0) {
        questionQaaCategoryInfo.setCheckedList([]);
      }
        */
    },
    [
      checkedCategoryButtonIdList,
      setCheckedCategoryButtonInfoList,
      questionOptionInfo,
      initialPracticeQuestionSetting,
    ],
  );

  /**
   * modifiedCheckedCategoryIdList
   * 選択されたカテゴリIDのリストを変換した配列です。
   * 正規表現パターンを使用して、選択されたカテゴリIDのリストをフィルタリングし、変換します。
   * 変換された配列は、[subject]-[bigCategory]-[smallCategory]の形式で表されます。
   *
   * @returns 変換されたカテゴリIDの配列
   */

  const _modifyCheckedCategoryIdList = useCallback(
    (_checkedCategoryIdList: string[]) => {
      const pattern = /small-(.+)-(.+)-(.+)/g;
      //    const _checkedCategoryIdList = checkedCategoryButtonIdList;
      /*
      questionFormatInfo.checkedIdList[0] === // currentSelected...は使えないため
      initialPracticeQuestionSetting.questionFormat[1].id
        ? questionQaaCategoryInfo.checkedIdList
        : questionCategoryInfo.checkedIdList;
        */
      return _checkedCategoryIdList
        .filter((v) => {
          return v.match(pattern);
        })
        .map((v) => {
          const [_, subject, bigCategory, smallCategory] = v.split('-');
          return `${subject}-${bigCategory}-${smallCategory}`;
        });
    },
    [
      /*    questionCategoryInfo,
    questionQaaCategoryInfo,
    questionFormatInfo,
    initialPracticeQuestionSetting.questionFormat,
    */
    ],
  );

  /** チェックした小カテゴリ―のDataLengthMapのオブジェクトを取得 */
  /*
  const checkedSmallCategoryDataLengthMapValue = useMemo(() => {
    const currentCategoryDataLengthMap = getCategoryDataLengthMap(
      questionFormatInfo.checkedIdList[0] ===
        initialPracticeQuestionSetting.questionFormat[1].id,
    );
    // console.log('currentCategoryDataLengthMap', currentCategoryDataLengthMap);
    // console.log('modifiedCheckedCategoryIdList', modifiedCheckedCategoryIdList);
    return modifyCheckedCategoryIdList(checkedCategoryButtonIdList).flatMap(
      (v, i) => {
        return Object.values(currentCategoryDataLengthMap).filter((v2, i2) => {
          // console.log(Object.keys(currentCategoryDataLengthMap)[i2]);
          // console.log(Object.values(currentCategoryDataLengthMap)[i2]);
          return v === Object.keys(currentCategoryDataLengthMap)[i2];
        });
      },
    );
  }, [
    modifyCheckedCategoryIdList,
    checkedCategoryButtonIdList,
    questionFormatInfo,
    getCategoryDataLengthMap,
    initialPracticeQuestionSetting.questionFormat,
  ]);
  */

  /** 現在選択されている練習モードの問題設定idリスト */
  const currentSelectedPracticeSettingIdList: PracticeQuestionSettingIdList =
    useMemo(() => {
      return {
        questionCategory: isCurrentSelectedQaa
          ? []
          : checkedCategoryButtonIdList,
        qaaQuestionCategory: isCurrentSelectedQaa
          ? checkedCategoryButtonIdList
          : [],
        questionFormat: questionFormatInfo.checkedIdList,
        questionOrder: questionOrderInfo.checkedIdList,
        questionDifficulties: questionDifficultiesInfo.checkedIdList,
        questionCoverage: questionCoverageInfo.checkedIdList,
        option: questionOptionInfo.checkedIdList,
        numberOfQuestions: [questionNumberOfQuestionsInfo.inputId],
        questionTime: [questionTimeInfo.formattedId],
      };
    }, [
      isCurrentSelectedQaa,
      checkedCategoryButtonIdList,
      questionFormatInfo.checkedIdList,
      questionOrderInfo.checkedIdList,
      questionDifficultiesInfo.checkedIdList,
      questionCoverageInfo.checkedIdList,
      questionOptionInfo.checkedIdList,
      questionNumberOfQuestionsInfo.inputId,
      questionTimeInfo.formattedId,
    ]);

  /** 問題形式に応じたカテゴリ―ButtonInfoList */
  /*
  const selectedQuestionCategoryInfo = useMemo(() => {
    if (isCurrentSelectedQaa) return questionQaaCategoryInfo;
    return questionCategoryInfo;
  }, [isCurrentSelectedQaa, questionCategoryInfo, questionQaaCategoryInfo]);
  */

  /** 出題可能な最大問題数 */
  const maxNumberOfQuestion = useMemo(() => {
    console.log(
      'update maxNumberOfQuestion',
      summarizeConsoleValue(questionCountMap),
    );
    if (checkedCategoryButtonIdList.length === 0) return 0;
    const result = checkedCategoryButtonIdList.reduce((acc, id) => {
      if (!questionCountMap[id] || id.split('-').length < 4) return acc;
      return acc + questionCountMap[id];
    }, 0);

    return result;
    /*
    if (checkedSmallCategoryDataLengthMapValue.length === 0) return 0;
    return checkedSmallCategoryDataLengthMapValue.reduce((acc, cur) => {
      return (
        acc +
        getEachCategoryNumberOfQuestions(
          cur,
          questionCoverageInfo.checkedType,
          questionDifficultiesInfo.checkedList,
        )
      );
    }, 0);
    */
  }, [questionCountMap, checkedCategoryButtonIdList]);

  /** Defined Functions */
  // カテゴリ―以外のIdListを文字列に変換
  const getPracticeOtherSettingString = useCallback(
    (list: PracticeQuestionSettingIdList) => {
      const keys = Object.keys(list) as Array<
        keyof PracticeQuestionSettingIdList
      >;
      const string = keys.reduce<PracticeQuestionSettingIdList>(
        (acc, key) => {
          const value = list[key].map((v, _i) => {
            if (key === 'questionCategory' || key === 'qaaQuestionCategory')
              return '';
            if (key === 'numberOfQuestions') {
              const number = /\d+$/.exec(list.numberOfQuestions[0]);
              if (number === null) {
                return '0問';
              }

              return `${number[0]}問`;
            }

            if (key === 'questionTime') {
              if (
                // 無制限の場合
                list.questionTime[0] ===
                initialPracticeQuestionSettingId.questionTime[0]
              ) {
                return initialPracticeQuestionSetting.questionTime[0].name;
              }

              const time = /\d+$/.exec(list.questionTime[0]);
              if (time === null) {
                return '0分';
              }

              return `${time[0]}分`;
            }

            if (key === 'option') {
              return v === initialPracticeQuestionSettingId.option[0]
                ? '選択肢をシャッフル'
                : 'なし';
            }

            const buttonInfo = idToCheckedButtonInfoList(
              v,
              initialPracticeQuestionSetting[key],
            );
            //            console.log('buttonInfo', buttonInfo);
            return buttonInfo.length > 0 ? buttonInfo[0].name : '';
          });

          acc[key] = key === 'questionDifficulties' ? [value.join('/')] : value;
          return acc;
        },
        {
          questionFormat: [],
          questionOrder: [],
          questionDifficulties: [],
          questionCoverage: [],
          option: [],
          numberOfQuestions: [],
          questionTime: [],
          questionCategory: [],
          qaaQuestionCategory: [],
        },
      );
      const idList = Object.keys(string) as Array<
        keyof PracticeQuestionSettingIdList
      >;
      const newString = Object.values(string)
        .filter((_v, i) => {
          return (
            idList[i] !== 'questionCategory' &&
            idList[i] !== 'qaaQuestionCategory'
          );
        })
        .join('/');
      return newString;
    },
    [
      idToCheckedButtonInfoList,
      initialPracticeQuestionSetting,
      initialPracticeQuestionSettingId,
    ],
  );

  // 練習モードの選択した設定をPracticeQuestionSettingIdListに変更
  /*
  const practiceButtonInfoListToId: (
    currentSelectedPracticeSetting: PracticeQuestionSettingType,
  ) => PracticeQuestionSettingIdList = useCallback(
    (currentSelectedPracticeSetting: PracticeQuestionSettingType) => {
      const practiceSettingkeys = Object.keys(
        initialPracticeQuestionSetting,
      ) as Array<keyof PracticeQuestionSettingIdList>;
      // console.log(practiceSettingkeys);
      return practiceSettingkeys.reduce<PracticeQuestionSettingIdList>(
        (object, key) => {
          object[key] = currentSelectedPracticeSetting[key].map((v, i) => {
            // console.log(v.id);
            return v.id;
          });
          return object;
        },
        initialPracticeQuestionSettingId,
      );
    },
    [initialPracticeQuestionSetting, initialPracticeQuestionSettingId],
  );
  */

  /** 条件に合う問題候補を選出 */
  const getSettedTargetingTestData = useCallback(
    (
      _isQaa?: boolean,
      _currentSelectedPracticeSettingIdList?: PracticeQuestionSettingIdList,
    ): TestData[] => {
      _currentSelectedPracticeSettingIdList ??=
        currentSelectedPracticeSettingIdList;
      _isQaa ??= isCurrentSelectedQaa;

      const _checkedCategoryIdList = _isQaa
        ? _currentSelectedPracticeSettingIdList.qaaQuestionCategory
        : _currentSelectedPracticeSettingIdList.questionCategory;

      const list = _checkedCategoryIdList.filter((v) =>
        v.includes('small-', 0),
      );

      const categoryDataLengthMap = getCategoryDataLengthMap(_isQaa);
      // const currentCategoryData = getCategoryData(isCurrentSelectedQaa);
      // console.log('testDataList', testDataList);
      const list2 = list.reduce<TestData[]>((acc, key) => {
        const [_categoryName, _subject, _bigCategory, _smallCategory] =
          key.split('-');
        /*      if (currentCategoryData[subject]?.[bigCategory]?.[smallCategory]) {
        const list3 = currentCategoryData[subject][bigCategory][smallCategory];
      */
        const id = key.replace('small-', '');
        if (categoryDataLengthMap[id]) {
          const list3 = categoryDataLengthMap[id].totalList._total;
          /*
        console.log(
          `${subject}=>${bigCategory}=>${smallCategory}の問題Noリスト`,
          list3,
        );
        */
          // 難易度
          const difficult: string[] =
            _currentSelectedPracticeSettingIdList.questionDifficulties.map(
              (v) => {
                switch (v) {
                  case 'pqs_questionDifficulties_three': {
                    return '3';
                  }

                  case 'pqs_questionDifficulties_two': {
                    return '2';
                  }

                  case 'pqs_questionDifficulties_one': {
                    return '1';
                  }

                  default: {
                    return '0';
                  }
                }
              },
            ) ?? ['0'];

          // 出題対象範囲
          const coverage =
            _currentSelectedPracticeSettingIdList.questionCoverage[0];

          // 難易度・出題対象範囲に合致する問題Noリスト
          const filteredNoList = list3.filter((no) => {
            const data = testDataList[no];
            try {
              const id = generateTestDataId(data, isCurrentSelectedQaa);
              // 難易度
              if (!difficult.includes(data.difficult)) return false;
              // 苦手問題
              if (
                coverage === 'pqs_questionCoverage_onlyWeakSpot' &&
                !weakPointTestIdList.includes(id)
              )
                return false;
              // 未回答
              if (
                coverage === 'pqs_questionCoverage_onlyUnanswered' &&
                answeredTestIdList.includes(id)
              )
                return false;
              // 苦手問題または未回答
              if (
                coverage ===
                  'pqs_questionCoverage_bothUnCorrectlyAndWeakSpot' &&
                !weakPointTestIdList.includes(id) &&
                answeredTestIdList.includes(id)
                // !weakPointOrUnAnsweredTestIdList.includes(id)
              )
                return false;

              return true;
            } catch (error: unknown) {
              console.error('generateTestDataId error', error);
              const {name, message} =
                error instanceof Error
                  ? error
                  : {name: 'UnknownError', message: 'Unknown error occurred'};
              logErrorToAnalytics(name, message, 'getSettedTargetingTestData', {
                grade: data.grade,
                subject: data.subject,
                no: data.no,
              });
              return false;
            }
          });

          const filteredTestList = filteredNoList.map((no) => testDataList[no]);
          /*
        console.log(
          `${subject}=>${bigCategory}=>${smallCategory}に存在する条件に合致する問題リスト`,
          filteredTestList,
        );
        */
          // biome-ignore lint/performance/noAccumulatingSpread: 公開前のため現行のロジックを維持する
          return [...acc, ...filteredTestList];
        }

        return acc;
      }, []);

      return list2;
    },
    [
      isCurrentSelectedQaa,
      currentSelectedPracticeSettingIdList,
      weakPointTestIdList,
      answeredTestIdList,
      // getCategoryData,
      getCategoryDataLengthMap,
      testDataList,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const setQuestionInfosByIdList = useCallback(
    (
      idList: PracticeQuestionSettingIdList,
      settingModeType: QuestionModeType,
    ) => {
      const checkedCategoryButtonInfoList = idListToCheckedButtonList(
        idList.questionFormat[0] === practiceQuestionFormat.qAndA.id
          ? idList.qaaQuestionCategory
          : idList.questionCategory,
        questionCategoryCommonButtonList.buttonList,
      );
      setCheckedCategoryButtonInfoList(checkedCategoryButtonInfoList);
      /*
      questionCategoryInfo.setCheckedList(
        idListToCheckedButtonList(
          idList.questionCategory,
          questionCategoryInfo.buttonList,
        ),
      );
      */
      /*
      questionQaaCategoryInfo.setCheckedList(
        idListToCheckedButtonList(
          idList.qaaQuestionCategory,
          questionQaaCategoryInfo.buttonList,
        ),
      );
      */

      if (settingModeType === questionMode.practice) {
        questionFormatInfo.setCheckedList(
          idListToCheckedButtonList(
            idList.questionFormat,
            initialPracticeQuestionSetting.questionFormat,
          ),
        );
        questionOrderInfo.setCheckedList(
          idListToCheckedButtonList(
            idList.questionOrder,
            questionOrderInfo.buttonList,
          ),
        );
        questionDifficultiesInfo.setCheckedList(
          idListToCheckedButtonList(
            idList.questionDifficulties,
            initialPracticeQuestionSetting.questionDifficulties,
          ),
        );
        questionCoverageInfo.setCheckedList(
          idListToCheckedButtonList(
            idList.questionCoverage,
            initialPracticeQuestionSetting.questionCoverage,
          ),
        );
        questionOptionInfo.setCheckedList(
          idListToCheckedButtonList(
            idList.option,
            initialPracticeQuestionSetting.option,
          ),
        );
        if (
          idList.questionTime[0] ===
          initialPracticeQuestionSettingId.questionTime[0]
        ) {
          questionTimeInfo.setCheckedList([
            initialPracticeQuestionSetting.questionTime[0],
          ]);
        } else {
          questionTimeInfo.setCheckedList([
            initialPracticeQuestionSetting.questionTime[1],
          ]);
          const m = /\d+$/.exec(idList.questionTime[0]);
          const time = m ? m[0] : '0';
          questionTimeInfo.setSelectedValue(time);
        }

        const m = /\d+$/.exec(idList.numberOfQuestions[0]);
        // console.log('m', m);
        const number_ = m ? m[0] : '0';
        // console.log('number_', number_);
        questionNumberOfQuestionsInfo.setSelectedValue([number_]);
      }
    },
    [
      idListToCheckedButtonList,
      initialPracticeQuestionSettingId,
      questionCategoryCommonButtonList,
    ],
  );
  const setQuestionInfosByCardData = useCallback(
    (card: SettingCardData) => {
      const settingModeType = card.questionMode;
      const idList =
        settingModeType === questionMode.practice
          ? card.practiceQuestionSetting
          : {...initialPracticeQuestionSettingId, ...card.examQuestionSetting};
      setQuestionInfosByIdList(idList, settingModeType);
    },
    [initialPracticeQuestionSettingId, setQuestionInfosByIdList],
  );

  const settingBySettingState = useCallback(
    (setting: {
      currentSettingId: string;
      settingState: QuestionSettingStateType;
      questionModeType: QuestionModeType;
      isCalledSaved: boolean;
    }) => {
      const {currentSettingId, settingState, questionModeType} = setting;
      if (
        settingState === questionSettingState.saved ||
        settingState === questionSettingState.task ||
        settingState === questionSettingState.previous ||
        settingState === questionSettingState.interrupted ||
        settingState === questionSettingState.categoryDataAnalysis
      ) {
        let idList: PracticeQuestionSettingIdList;

        switch (settingState) {
          case questionSettingState.previous: {
            idList = previousSavedSetting!.practiceQuestionSetting;
            break;
          }

          /*
          case questionSettingState.categoryDataAnalysis: {
            idList = modifyDataAnalysisQuestionSettingIdList(
              currentSettingId,
              checkedCategoryButtonIdList,
              dataAnalysisQuestionSettingState.questionFormat ===
                initialPracticeQuestionSetting.questionFormat[1].id,
            );

            break;
          }
          */

          case questionSettingState.task: {
            if (questionModeType === questionMode.exam) {
              idList = initialPracticeQuestionSettingId;
              break;
            }

            const currentSetting = savedSettingList[currentSettingId];
            idList = currentSetting.taskSetting?.hasTask
              ? currentSetting.practiceQuestionSetting
              : initialPracticeQuestionSettingId;

            break;
          }

          default: {
            idList = savedSettingList[currentSettingId].practiceQuestionSetting;
            break;
          }
        }

        if (idList === null) return;
        // console.log('idList', idList);
        setQuestionInfosByIdList(idList, questionModeType);
      }
    },
    [
      previousSavedSetting,
      savedSettingList,
      initialPracticeQuestionSettingId,
      setQuestionInfosByIdList,
      //      modifyDataAnalysisQuestionSettingIdList,
      // checkedCategoryButtonIdList,
      //      dataAnalysisQuestionSettingState,
      // initialPracticeQuestionSetting.questionFormat,
    ],
  );

  /** Defined Effects */
  /** settingStateが課題・保存した設定に変更されたときに各種ButtonListを更新する */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    settingBySettingState(currentSetting);
  }, [currentSetting]);

  return {
    questionOrderInfo,
    questionCoverageInfo,
    questionDifficultiesInfo,
    questionTimeInfo,
    questionOptionInfo,
    questionFormatInfo,
    questionNumberOfQuestionsInfo,
    initializeQuestionInfo,
    initializeCategoryCheckList,
    getTargetQuestionSettingId,
    currentSelectedPracticeSettingIdList,
    getPracticeOtherSettingString,
    maxNumberOfQuestion,
    categorySubject,
    setCategorySubject,
    isCurrentSelectedQaa,
    getSettedTargetingTestData,
    testDataList,
    qualifiedQuestionCount,
    setQualifiedQuestionCount,
    requiredQuestionCount,
    setRequiredQuestionCount,
    setIsPracticeQuestionStartReserved,
    isPracticeQuestionStartReserved,
    setQuestionInfosByCardData,
    questionCategoryCommonButtonList,
    checkedCategoryButtonInfoList,
    setCheckedCategoryButtonInfoList,
    checkedCategoryButtonIdList,
    questionCountMap,
    getQuestionNameWithCount,
    //    ...dataAnalysisQuestionSetting,
  };
};

export default usePracticeQuestionSetting;

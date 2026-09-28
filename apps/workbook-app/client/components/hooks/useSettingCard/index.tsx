import {useState, useCallback, useContext, useMemo, useEffect} from 'react';
import {getCheckedCategoryString} from '@functionals/getCheckedCategoryString';
import {getYmdDayString, getYmdDayTimeString} from '@functionals/timeManager';
import type {Timestamp} from '@react-native-firebase/firestore';
import {
  GlobalSaveDataContext,
  type SettingCardData,
} from '../useGlobalSaveDataContext';
import {InitialSettingDataContext} from '../useInitialSettingDataContext';
import {QuestionSettingViewContext} from '../useQuestionSettingViewContext';
import {useSettingCardCache} from './useSettingCardChache';
import {questionMode} from '@/types/commonUnionType';

const useSettingCard = (
  id: string,
  _hasInterruptedData?: boolean,
): [
  cardData: SettingCardData | null,
  taskDate: string | undefined,
  deadlineDate: string | undefined,
  titleColor: string,
  borderColor: string,
  categoryString: string,
  otherSettingString: string,
  //  onPressOutTaskSettingCard: () => void,
  //  onPressOutSavedSettingCard: () => void,
  // onPressOutPreviousSettingCard: () => void,
] => {
  const {readStringCache, writeStringCache} = useSettingCardCache();
  const [categoryString, setCategoryString] = useState<string>('');
  const [otherSettingString, setOtherSettingString] = useState<string>('');
  const [_isLoading, setIsLoading] = useState<boolean>(true);
  const [taskDate, setTaskDate] = useState<string | undefined>(undefined);
  const [deadlineDate, setDeadlineDate] = useState<string | undefined>(
    undefined,
  );
  const {savedSettingList, previousSavedSetting, answerlingTestSettingData} =
    useContext(GlobalSaveDataContext);
  const {
    idToCheckedButtonInfoList,
    initialExamSubjectButtonInfoList,
    getExamNumberOfQuestionsButtonInfoList,
  } = useContext(InitialSettingDataContext);

  const {getPracticeOtherSettingString, questionCategoryCommonButtonList} =
    useContext(QuestionSettingViewContext);

  const cardData = useMemo(() => {
    // console.log('🆙cardData更新', id);
    switch (true) {
      case id.includes('task') || id.includes('saved'): {
        return savedSettingList[id] ?? null;
      }

      case id.includes('previous'): {
        return previousSavedSetting ?? null;
      }

      case id.includes('interrupted'): {
        if (
          answerlingTestSettingData === null ||
          answerlingTestSettingData.settingCardData.id !== id
        )
          return null;
        return answerlingTestSettingData.settingCardData ?? null;
      }

      default: {
        return null;
      }
    }
  }, [id, savedSettingList, previousSavedSetting, answerlingTestSettingData]);

  // キャッシュ読み込みと文字列計算
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    const loadStringData = async () => {
      if (!cardData) {
        setCategoryString('');
        setOtherSettingString('');
        setIsLoading(false);
        return;
      }

      try {
        // キャッシュから読み込み
        const cachedData = await readStringCache(id, cardData);

        if (cachedData) {
          // キャッシュが有効な場合、即座に設定
          setCategoryString(cachedData.categoryString);
          setOtherSettingString(cachedData.otherSettingString);
          setTaskDate(cachedData.taskDate);
          setDeadlineDate(cachedData.deadlineDate);
          setIsLoading(false);
          return;
        }

        // キャッシュがない場合、計算して保存
        const [calcCategoryString, calcOtherString] =
          calculateStrings(cardData);

        setCategoryString(calcCategoryString);
        setOtherSettingString(calcOtherString);

        // 非同期でキャッシュに保存
        const stringData = {
          categoryString: calcCategoryString,
          otherSettingString: calcOtherString,
          taskDate: getTaskDateString(cardData),
          deadlineDate: getDeadlineDate(cardData.taskSetting?.deadlineDate),
          titleColor: cardData.taskSetting?.isExpired
            ? 'text-errorred-400'
            : 'text-primary',
          borderColor: cardData.taskSetting?.isExpired
            ? 'border border-errorred-400'
            : '',
        };

        writeStringCache(id, stringData, cardData).catch((error: unknown) => {
          console.error('Failed to write string cache:', error);
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load string data:', error);
        // フォールバック: 直接計算
        const [calcCategoryString, calcOtherString] =
          calculateStrings(cardData);
        setCategoryString(calcCategoryString);
        setOtherSettingString(calcOtherString);
        setIsLoading(false);
      }
    };

    loadStringData().catch((error: unknown) => {
      console.error('Error in useEffect loadStringData:', error);
      setIsLoading(false);
    });
  }, [cardData]);

  // 既存の計算ロジックを関数として分離
  const calculateStrings = useCallback(
    (data: SettingCardData): [string, string] => {
      // 既存のuseMemoの計算ロジックをここに移動
      try {
        // console.log('cardData更新', cardData);
        if (data === null) return ['', ''];
        /** 練習モードの場合 */
        if (data.questionMode === questionMode.practice) {
          // カテゴリ―の文字列
          /*
          const currentCategoryData = getCategoryData(
            cardData.isQaa ?? false,
            //          answerlingTestSettingData?.settingCardData.isQaa ?? false,
          );
          */
          // console.log('currentCategoryData', currentCategoryData);
          const currentQuestionCategory = data.isQaa
            ? data.practiceQuestionSetting.qaaQuestionCategory
            : data.practiceQuestionSetting.questionCategory;
          // console.log('currentQuestionCategory', currentQuestionCategory);
          const questionCategoryString = getCheckedCategoryString(
            currentQuestionCategory,
            questionMode.practice,
            questionCategoryCommonButtonList.buttonList,
          );
          // console.log('questionCategoryString', questionCategoryString);

          // その他の文字列
          const other = getPracticeOtherSettingString(
            data.practiceQuestionSetting,
          );
          // console.log('other', other);

          return [questionCategoryString, other];
        }

        /** 模擬試験モードの場合 */
        if (data.questionMode === questionMode.exam) {
          const examButtonInfoList = idToCheckedButtonInfoList(
            data.examQuestionSetting.subject[0],
            initialExamSubjectButtonInfoList,
          );
          // console.log('examButtonInfoList', examButtonInfoList);
          const subjectString =
            examButtonInfoList.length > 0 ? examButtonInfoList[0]?.name : '';

          const pattern = /eqs_\d級_(subject.+)/g;
          const subject = data.examQuestionSetting.subject[0].replaceAll(
            pattern,
            '$1',
          );

          const subjectButtonInfo =
            getExamNumberOfQuestionsButtonInfoList(subject);
          const numberOfQuestionButtonInfoList = idToCheckedButtonInfoList(
            data.examQuestionSetting.numberOfQuestions[0],
            subjectButtonInfo,
          );
          /* console.log(
            'numberOfQuestionButtonInfoList',
            numberOfQuestionButtonInfoList,
          );
          */
          const numberOfQuestionString =
            numberOfQuestionButtonInfoList.length > 0
              ? numberOfQuestionButtonInfoList[0]?.name
              : '';

          return [subjectString, numberOfQuestionString];
        }

        return ['', ''];
      } catch (error: unknown) {
        console.error('calculateStrings：処理失敗', error);
        throw new Error('GET Question Setting Error');
      }
    },
    [
      getPracticeOtherSettingString,
      getExamNumberOfQuestionsButtonInfoList,
      idToCheckedButtonInfoList,
      initialExamSubjectButtonInfoList,
      questionCategoryCommonButtonList.buttonList,
    ],
  );

  /* FirebaseFirestoreTypes.Timestamp型を文字列に置換 */
  const getTaskDateString = useCallback((_cardData: SettingCardData | null) => {
    if (_cardData?.taskSetting?.taskDate) {
      const startDate = getYmdDayString(
        _cardData.taskSetting.taskDate[0].startAt,
      );
      const endDate = getYmdDayString(_cardData.taskSetting.taskDate[0].endAt);
      return startDate === endDate ? startDate : `${startDate}～${endDate}`;
    }

    return undefined;
  }, []);

  const getDeadlineDate = useCallback((deadlineDate: Timestamp | undefined) => {
    if (deadlineDate) {
      return getYmdDayTimeString(deadlineDate);
    }

    return undefined;
  }, []);

  /* CSS */
  const titleColor: string = useMemo(() => {
    if (cardData === null) return 'text-primary';
    return cardData.taskSetting?.isExpired
      ? 'text-errorred-400'
      : 'text-primary';
  }, [cardData]);

  const borderColor: string = useMemo(() => {
    if (cardData === null) return '';
    return cardData.taskSetting?.isExpired ? 'border border-errorred-400' : '';
  }, [cardData]);

  return [
    cardData,
    taskDate,
    deadlineDate,
    titleColor,
    borderColor,
    categoryString,
    otherSettingString,
    //    onPressOutTaskSettingCard,
    //    onPressOutSavedSettingCard,
    // onPressOutPreviousSettingCard,
  ];
};

export default useSettingCard;

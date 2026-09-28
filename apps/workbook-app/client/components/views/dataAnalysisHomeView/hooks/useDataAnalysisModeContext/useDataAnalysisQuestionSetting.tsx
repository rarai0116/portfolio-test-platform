import {useCallback, useContext, useMemo, useState} from 'react';
import {QuestionSettingViewContext} from '@hooks/useQuestionSettingViewContext';
import {InitialSettingDataContext} from '@hooks/useInitialSettingDataContext';
import type {CategoryDataCell} from '@views/dataAnalysisHomeView/hooks/useDataAnalysisModeContext/useDataAnalysisCategoryData';
import type {SettingCardData} from '@hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import {questionSettingState} from '@/types/commonUnionType';

/** Defined Types */
type DataAnalysisQuestionSettingState = {
  categoryDataCell: CategoryDataCell | null;
  questionFormat: string;
};

export type DataAnalysisQuestionSetting = {
  dataAnalysisQuestionSettingState: DataAnalysisQuestionSettingState;
  setDataAnalysisQuestionSettingState: React.Dispatch<
    React.SetStateAction<DataAnalysisQuestionSettingState>
  >;

  // initialDataAnalysisQuestionSettingIdList: PracticeQuestionSettingIdList;
  getNestedCategoryIds: (
    buttonIdList: string[],
    currentSettingId: string,
  ) => string[];
  /*
  modifyDataAnalysisQuestionSettingIdList: (
    settingId: string,
    buttonIdList: string[],
    isQaa: boolean,
  ) => PracticeQuestionSettingIdList;
   */
  settingIdToCardData: (
    data: CategoryDataCell,
    settingId: string,
    isQaa: boolean,
  ) => SettingCardData | null;
};

const useDataAnalysisQuestionSetting: () => DataAnalysisQuestionSetting =
  () => {
    /** Load Context */
    const {initialPracticeQuestionSetting, initialExamQuestionSettingId} =
      useContext(InitialSettingDataContext);
    const {grade} = useContext(GlobalUserSettingContext);
    const {questionCategoryCommonButtonList} = useContext(
      QuestionSettingViewContext,
    );

    /** Define States */
    const [
      dataAnalysisQuestionSettingState,
      setDataAnalysisQuestionSettingState,
    ] = useState<DataAnalysisQuestionSettingState>({
      categoryDataCell: null,
      questionFormat: initialPracticeQuestionSetting.questionFormat[0].id,
    });

    /** Defined Memos */
    const _numberOfQuestions = useMemo(() => {
      const data = dataAnalysisQuestionSettingState.categoryDataCell;
      if (!data) return 0;
      return data.noAnswered + data.weakly;
      // return data.correctlyAndNoWeakly + data.weakly + data.noAnswered;
    }, [dataAnalysisQuestionSettingState.categoryDataCell]);

    /** 分析モードの初期設定id */
    /*
    const initialDataAnalysisQuestionSettingIdList: PracticeQuestionSettingIdList =
      useMemo(() => {
        return {
          questionCategory: [],
          qaaQuestionCategory: [],
          questionFormat: [dataAnalysisQuestionSettingState.questionFormat],
          questionOrder: [initialPracticeQuestionSetting.questionOrder[1].id],
          questionDifficulties: [
            initialPracticeQuestionSetting.questionDifficulties[0].id,
            initialPracticeQuestionSetting.questionDifficulties[1].id,
            initialPracticeQuestionSetting.questionDifficulties[2].id,
          ],
          questionCoverage: [
            initialPracticeQuestionSetting.questionCoverage[2].id,
          ],
          option: [initialPracticeQuestionSetting.option[0].id],
          numberOfQuestions: [
            `pqs_questionNumberOfQuestions_input_${numberOfQuestions}`,
          ],
          questionTime: [initialPracticeQuestionSetting.questionTime[0].id],
        };
      }, [
        initialPracticeQuestionSetting,
        dataAnalysisQuestionSettingState.questionFormat,
        numberOfQuestions,
      ]);
    */

    /** Defined Functions */
    /**
     * 選択したボタンとその下位カテゴリに属するボタンのidリストを全て取得する
     * 名前どうしよう
     *
     */
    const getNestedCategoryIds = useCallback(
      (
        buttonIdList: string[],
        // questionCategoryInfo: QuestionButtonSettingInfo,
        settingId: string,
      ) => {
        const patternSubject = /subject-(.+)/;
        const patternBigCategory = /big-(.+)-(.+)/;
        if (settingId.includes('subject')) {
          // subject-以下の文字列を取得
          const string = settingId.replace(patternSubject, '$1');
          // subjectの場合は、その下のsmallCategoryのidを取得
          const idList = buttonIdList.filter((v) => {
            return v.includes(string);
          });

          return idList;
        } else if (settingId.includes('big')) {
          // bigCategoryの場合は、その下のsmallCategoryのidを取得
          const string = settingId.replace(patternBigCategory, '$1-$2');
          const idList = buttonIdList.filter((v) => {
            return v.includes(string);
          });

          return idList;
        }

        return [settingId];
      },
      [],
    );
    /** 問題形式に応じて修正した分析モードの問題設定idリスト */
    /*
    const modifyDataAnalysisQuestionSettingIdList: (
      settingId: string,
      buttonIdList: string[],
      isQaa: boolean,
    ) => PracticeQuestionSettingIdList = useCallback(
      (settingId: string, buttonIdList: string[], isQaa: boolean) => {
        const newCategory = getNestedCategoryIds(buttonIdList, settingId);

        return {
          ...initialDataAnalysisQuestionSettingIdList,
          questionCategory: isQaa ? [] : newCategory,
          qaaQuestionCategory: isQaa ? newCategory : [],
        };
      },
      [initialDataAnalysisQuestionSettingIdList, getNestedCategoryIds],
    );
    */

    const settingIdToCardData = useCallback(
      (
        data: CategoryDataCell,
        settingId: string,
        isQaa: boolean,
      ): SettingCardData | null => {
        if (!data) return null;
        const category = getNestedCategoryIds(
          questionCategoryCommonButtonList.buttonIdList,
          settingId,
        );
        const cardData: SettingCardData = {
          id: settingId,
          grade: grade!,
          settingState: questionSettingState.categoryDataAnalysis,
          questionMode: '練習モード',
          isQaa,
          practiceQuestionSetting: {
            ...initialPracticeQuestionSetting,
            questionFormat: [
              isQaa
                ? initialPracticeQuestionSetting.questionFormat[1].id
                : initialPracticeQuestionSetting.questionFormat[0].id,
            ],
            questionOrder: [initialPracticeQuestionSetting.questionOrder[1].id],
            questionDifficulties:
              initialPracticeQuestionSetting.questionDifficulties.map(
                (v) => v.id,
              ),
            questionCoverage: [
              initialPracticeQuestionSetting.questionCoverage[2].id,
            ],
            option: [initialPracticeQuestionSetting.option[0].id],
            numberOfQuestions: [
              `pqs_questionNumberOfQuestions_input_${(data.noAnswered + data.weakly).toString()}`,
            ],
            questionTime: [initialPracticeQuestionSetting.questionTime[0].id],
            questionCategory: isQaa ? [] : [...category],
            qaaQuestionCategory: isQaa ? [...category] : [],
          },
          examQuestionSetting: initialExamQuestionSettingId,
        };
        return cardData;
      },

      [
        initialPracticeQuestionSetting,
        initialExamQuestionSettingId,
        grade,
        getNestedCategoryIds,
        questionCategoryCommonButtonList.buttonIdList,
      ],
    );

    return {
      dataAnalysisQuestionSettingState,
      setDataAnalysisQuestionSettingState,
      // initialDataAnalysisQuestionSettingIdList,
      getNestedCategoryIds,
      // modifyDataAnalysisQuestionSettingIdList,
      settingIdToCardData,
    };
  };

export default useDataAnalysisQuestionSetting;

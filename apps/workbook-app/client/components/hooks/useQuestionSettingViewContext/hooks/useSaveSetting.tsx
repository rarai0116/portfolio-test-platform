import {useState, useMemo, useCallback, useContext} from 'react';
import type {ButtonStateType} from '../../useButtonContext';
import {ButtonStates} from '../../useButtonContext';
import {
  questionMode,
  questionSettingState,
} from '../../../../types/commonUnionType';
import type {
  QuestionModeType,
  QuestionGradeType,
} from '../../../../types/commonUnionType';
import {
  GlobalSaveDataContext,
  type SettingCardData,
} from '../../useGlobalSaveDataContext';
import {InitialSettingDataContext} from '../../useInitialSettingDataContext';
import {GlobalUserSettingContext} from '../../useGlobalUserSettingContext';
import type {PracticeQuestionSettingIdList} from './usePracticeQuestionSetting';
import type {ExamQuestionSettingIdList} from './useExamQuestionSetting';

export type SaveSetting = {
  savedSettingListArray: SettingCardData[];
  isInCalendarTaskSetting: boolean;
  setIsInCalendarTaskSetting: React.Dispatch<React.SetStateAction<boolean>>;
  saveFolderButtonState: ButtonStateType;
  saveFolderButtonColor: string;
  writeSavedQuestionSetting: (title: string, mode: QuestionModeType) => void;
};

type SaveFolderIconColor = {
  default: string;
  disabled: string;
  pressed: string;
  active: string;
};

/** Constants */
// 保存フォルダアイコンの色
const saveFolderIconColor: SaveFolderIconColor = {
  default: '#FFFFFF', // デフォルト
  disabled: '#FFFFFF', // 無効
  pressed: '#CCCCCC', // 押下時
  active: '#289DF4', // 有効時
};

const useSaveSetting: (props: {
  questionModeType: QuestionModeType; // 出題モード
  isSavable: boolean; // 現在、保存対象の設定を呼び出しているか
  currentSelectedPracticeSettingIdList: PracticeQuestionSettingIdList; // 練習モードで現在選択中の設定IDリスト
  currentSelectedExamSettingIdList: ExamQuestionSettingIdList; // 試験モードで現在選択中の設定IDリスト
  currentIndex: number | null;
  practiceSlides: string[];
  examSlides: string[];
}) => SaveSetting = (props) => {
  const {
    questionModeType,
    isSavable,
    currentSelectedPracticeSettingIdList,
    currentSelectedExamSettingIdList,
    currentIndex,
    practiceSlides,
    examSlides,
  } = props;

  /** Load Context */
  const {grade} = useContext(GlobalUserSettingContext);
  const {savedSettingList, addSavedSettingList} = useContext(
    GlobalSaveDataContext,
  );
  const {
    initialPracticeQuestionSettingId,
    initialPracticeQuestionSetting,
    initialExamQuestionSettingId,
  } = useContext(InitialSettingDataContext);

  /** Define States */
  // カレンダータスク設定画面にあるかどうか
  const [isInCalendarTaskSetting, setIsInCalendarTaskSetting] =
    useState<boolean>(false);

  // 保存した問題設定を取得
  const savedSettingListArray: SettingCardData[] = useMemo(() => {
    return Object.values(savedSettingList).filter((v) =>
      v.id.includes('saved'),
    );
  }, [savedSettingList]);

  /** QuestionMode(練習・模擬試験)に応じて保存データをフィルタリング */
  // biome-ignore lint/correctness/useExhaustiveDependencies: ログ削除前の依存関係を維持し、処理の再実行条件を変更しない。
  const savedSettingListFilteredByQuestionMode = useMemo(() => {
    if (!isSavable) return [];

    return savedSettingListArray.filter((_v, i) => {
      if (questionModeType === questionMode.practice) {
        return savedSettingListArray[i].questionMode === questionMode.practice;
      }

      return savedSettingListArray[i].questionMode === questionMode.exam;
    });
  }, [savedSettingListArray, questionModeType, savedSettingList, isSavable]);

  /** 練習モードの現在の設定と保存した設定を比較 */
  const compareCurrentToSavedPracticeSetting = useMemo(() => {
    if (questionModeType !== questionMode.practice) return false;
    if (currentIndex !== practiceSlides.length - 1) return false;
    if (savedSettingListFilteredByQuestionMode.length === 0) {
      return false;
    }

    const same = savedSettingListFilteredByQuestionMode.filter((_v, i) => {
      return (
        JSON.stringify(
          Object.values(currentSelectedPracticeSettingIdList).flat().sort(),
        ) ===
        JSON.stringify(
          Object.values(
            savedSettingListFilteredByQuestionMode[i].practiceQuestionSetting,
          )
            .flat()
            .sort(),
        )
      );
    });

    if (same.length > 0) {
      return true;
    } else {
      return false;
    }
  }, [
    savedSettingListFilteredByQuestionMode,
    currentSelectedPracticeSettingIdList,
    currentIndex,
    practiceSlides,
    questionModeType,
  ]);

  /** 模擬試験の現在の設定と保存した設定を比較 */
  const compareCurrentToSavedExamSetting = useMemo(() => {
    if (questionModeType !== questionMode.exam) return false;
    if (currentIndex !== examSlides.length - 1) return false;
    if (savedSettingListFilteredByQuestionMode.length === 0) {
      return false;
    }

    const same = savedSettingListFilteredByQuestionMode.filter((v, _i) => {
      return (
        v.examQuestionSetting.subject[0] ===
          currentSelectedExamSettingIdList.subject[0] &&
        v.examQuestionSetting.numberOfQuestions[0] ===
          currentSelectedExamSettingIdList.numberOfQuestions[0]
      );
    });
    // console.log(same.length);
    if (same.length > 0) {
      return true;
    } else {
      return false;
    }
  }, [
    savedSettingListFilteredByQuestionMode,
    currentSelectedExamSettingIdList,
    currentIndex,
    examSlides,
    questionModeType,
  ]);
  const saveFolderButtonState = useMemo(() => {
    if (!isSavable) return ButtonStates.disabled;
    if (questionModeType === questionMode.practice) {
      return compareCurrentToSavedPracticeSetting
        ? ButtonStates.disabled
        : ButtonStates.released;
    } else {
      return compareCurrentToSavedExamSetting
        ? ButtonStates.disabled
        : ButtonStates.released;
    }
  }, [
    isSavable,
    questionModeType,
    compareCurrentToSavedPracticeSetting,
    compareCurrentToSavedExamSetting,
  ]);
  const saveFolderButtonColor = useMemo(() => {
    switch (saveFolderButtonState) {
      case ButtonStates.disabled: {
        return saveFolderIconColor.disabled;
      }

      case ButtonStates.released: {
        return saveFolderIconColor.active;
      }
    }
  }, [saveFolderButtonState]);
  const idListToSettingCardData = useCallback(
    (
      grade: QuestionGradeType,
      mode: QuestionModeType,
      title: string,
      isQaa: boolean,
    ): SettingCardData => {
      return {
        id: '', // IDは保存時に設定されるので今はつけないで良い
        grade,
        title,
        settingState: questionSettingState.saved,
        questionMode: mode,
        practiceQuestionSetting:
          mode === questionMode.practice
            ? currentSelectedPracticeSettingIdList
            : initialPracticeQuestionSettingId,
        examQuestionSetting:
          mode === questionMode.exam
            ? currentSelectedExamSettingIdList
            : initialExamQuestionSettingId,
        isQaa,
      };
    },
    [
      currentSelectedPracticeSettingIdList,
      currentSelectedExamSettingIdList,
      initialPracticeQuestionSettingId,
      initialExamQuestionSettingId,
    ],
  );
  const writeSavedQuestionSetting = useCallback(
    async (title: string, mode: QuestionModeType) => {
      if (
        mode === questionMode.practice &&
        !currentSelectedPracticeSettingIdList
      )
        throw new Error('currentSelectedPracticeSettingIdList is not defined');
      if (mode === questionMode.exam && !currentSelectedExamSettingIdList)
        throw new Error('currentSelectedExamSettingIdList is not defined');
      if (!grade) throw new Error('grade is not defined');
      const settingCard = idListToSettingCardData(
        grade,
        mode,
        title,
        mode === questionMode.practice &&
          currentSelectedPracticeSettingIdList.questionFormat[0] ===
            initialPracticeQuestionSetting.questionFormat[1].id,
      );
      // 保存処理
      await addSavedSettingList(settingCard).catch((error: unknown) => {
        console.error('writeSavedQuestionSetting：処理失敗', error);
        throw new Error('Failed to save setting');
      });
    },
    [
      currentSelectedPracticeSettingIdList,
      currentSelectedExamSettingIdList,
      grade,
      idListToSettingCardData,
      addSavedSettingList,
      initialPracticeQuestionSetting.questionFormat,
    ],
  );
  return {
    savedSettingListArray,
    isInCalendarTaskSetting,
    setIsInCalendarTaskSetting,
    saveFolderButtonState,
    saveFolderButtonColor,
    writeSavedQuestionSetting,
  };
};

export default useSaveSetting;

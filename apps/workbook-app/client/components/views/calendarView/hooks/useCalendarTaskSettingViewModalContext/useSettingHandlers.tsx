import {summarizeConsoleValue} from '../../../../functionals/consoleLevels';
import {useCallback, useContext} from 'react';
import {Timestamp} from '@react-native-firebase/firestore';
import {isEqual} from 'lodash';
import {
  questionMode,
  type QuestionModeType,
  type TaskCalendarColor,
  taskSettingMode,
  type TaskSettingModeType,
} from '../../../../../types/commonUnionType';
import type {SettingCardData} from '../../../../hooks/useGlobalSaveDataContext';
import {TaskDataContext} from '../../../../hooks/useTaskDataContext';
import {
  type ExamQuestionSettingIdList,
  type PracticeQuestionSettingIdList,
  QuestionSettingViewContext,
} from '../../../../hooks/useQuestionSettingViewContext';
import type {CalendarDatePeriod} from '../../../../../types/customCalendarTypes';
import {getJapanDayBoundary} from '../../../../functionals/timeManager';
import {InitialSettingDataContext} from '../../../../hooks/useInitialSettingDataContext';
import type {SaveTaskSettingRefType} from './useSaveTaskSetting';

type SettingHandlersProps = {
  initialTaskSetting: SettingCardData;
  temporaryTaskSetting: SettingCardData;
  setTemporaryTaskSetting: React.Dispatch<
    React.SetStateAction<SettingCardData>
  >;
  setTemporaryPracticeQuestionSetting: React.Dispatch<
    React.SetStateAction<PracticeQuestionSettingIdList>
  >;
  setTemporaryExamQuestionSetting: React.Dispatch<
    React.SetStateAction<ExamQuestionSettingIdList>
  >;
  currentTaskSettingCardId: string | undefined;
  calendarTaskSettingMode: TaskSettingModeType;
  saveTaskSettingRef: React.RefObject<SaveTaskSettingRefType | null>;
  saveTaskSetting: () => Promise<void>;
  autoSaveTaskSetting: (data: SettingCardData) => void;
  isDefaultTitle: boolean;
  setIsDefaultTitle: React.Dispatch<React.SetStateAction<boolean>>;
  setCalendarTaskSettingMode: React.Dispatch<
    React.SetStateAction<TaskSettingModeType>
  >;
  setCurrentTaskSettingCardId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
};

export type SettingHandlers = {
  handleChangeTitle: (text: string) => void;
  saveTaskTitle: () => void;
  saveTaskDate: (selectedDateObj: CalendarDatePeriod) => void;
  saveTaskQuestionSetting: (
    questionModeType: QuestionModeType,
    currentSelectedPracticeSettingIdList?: PracticeQuestionSettingIdList,
    currentSelectedExamSettingIdList?: ExamQuestionSettingIdList,
  ) => void;
  resetTaskQuestionSetting: () => void;
  saveTaskColor: (color: TaskCalendarColor) => void;
  handleChangeTaskMemo: (text: string) => void;
  saveTaskMemo: () => void;
  initializeCalendarTaskSetting: (
    cardData: SettingCardData,
    id: string,
    callBack: () => void,
  ) => void;
};

const useSettingHandlers: (props: SettingHandlersProps) => SettingHandlers = (
  props,
) => {
  const {
    initialTaskSetting,
    temporaryTaskSetting,
    setTemporaryTaskSetting,
    setTemporaryPracticeQuestionSetting,
    setTemporaryExamQuestionSetting,
    currentTaskSettingCardId,
    calendarTaskSettingMode,
    saveTaskSettingRef,
    autoSaveTaskSetting,
    isDefaultTitle,
    setIsDefaultTitle,
    setCalendarTaskSettingMode,
    setCurrentTaskSettingCardId,
  } = props;

  const {initialPracticeQuestionSetting} = useContext(
    InitialSettingDataContext,
  );
  const {taskSettingList} = useContext(TaskDataContext);
  const {
    //    currentSelectedPracticeSettingIdList,
    //    currentSelectedExamSettingIdList,
    setQuestionInfosByCardData,
    setIsInCalendarTaskSetting,
  } = useContext(QuestionSettingViewContext);

  /** タイトル: テキスト変更 */
  const handleChangeTitle = useCallback(
    (text: string) => {
      const newSetting: SettingCardData = {
        ...temporaryTaskSetting,
        title: text,
      };
      if (isEqual(newSetting, temporaryTaskSetting)) return;
      setTemporaryTaskSetting(newSetting);
      setIsDefaultTitle(false);
    },
    [setTemporaryTaskSetting, temporaryTaskSetting, setIsDefaultTitle],
  );

  /** タイトル: 編集モードでフォーカスが外れた時に上書き保存 */
  const saveTaskTitle = useCallback(() => {
    if (currentTaskSettingCardId === undefined) return;
    if (!taskSettingList[currentTaskSettingCardId]) return;
    if (!temporaryTaskSetting.title) return;

    const isEditMode = calendarTaskSettingMode === taskSettingMode.edit;
    const isTitleChanged =
      taskSettingList[currentTaskSettingCardId].title !==
      temporaryTaskSetting.title;

    if (isEditMode && isTitleChanged) {
      autoSaveTaskSetting(temporaryTaskSetting);
      console.log('タイトルを上書き保存');
    }
  }, [
    calendarTaskSettingMode,
    currentTaskSettingCardId,
    taskSettingList,
    autoSaveTaskSetting,
    temporaryTaskSetting,
  ]);

  /** 日付: タスクカレンダーの日付選択時に保存 */
  const saveTaskDate = useCallback(
    (selectedDateObj: CalendarDatePeriod) => {
      void [
        selectedDateObj.start?.toISOString(),
        selectedDateObj.end?.toISOString(),
      ];
      if (!temporaryTaskSetting.taskSetting) return;
      if (!selectedDateObj.start) return;
      selectedDateObj.end ??= selectedDateObj.start; // 空の場合はstartと同じ日付を入れる

      const startDate = getJapanDayBoundary(selectedDateObj.start, 'start');
      const endDate = getJapanDayBoundary(selectedDateObj.end, 'end');
      const startAt = Timestamp.fromDate(startDate);
      const endAt = Timestamp.fromDate(endDate);
      /*
      console.log(
        'saveTaskDate: start',
        startDate.toISOString(),
        'end',
        endDate.toISOString(),
        'startAt',
        startAt.toDate().toISOString(),
        'endAt',
        endAt.toDate().toISOString(),
      );
      */

      const taskDates = [
        {
          startAt,
          endAt,
        },
      ];
      if (temporaryTaskSetting.taskSetting) {
        const newSetting = {
          ...temporaryTaskSetting,
          title: isDefaultTitle ? `課題` : temporaryTaskSetting.title,
          taskSetting: {
            ...temporaryTaskSetting.taskSetting,
            taskDate: taskDates,
          },
        };
        if (calendarTaskSettingMode === taskSettingMode.save) {
          setTemporaryTaskSetting(newSetting);
          console.log('日付を一時保存', summarizeConsoleValue(newSetting));
        } else {
          if (
            isEqual(
              saveTaskSettingRef.current?.taskDate,
              newSetting.taskSetting.taskDate,
            )
          )
            return;
          autoSaveTaskSetting(newSetting);
          console.log('日付を上書き保存', summarizeConsoleValue(newSetting));
        }
      }
    },
    [
      isDefaultTitle,
      calendarTaskSettingMode,
      autoSaveTaskSetting,
      temporaryTaskSetting,
      setTemporaryTaskSetting,
      saveTaskSettingRef,
    ],
  );

  /** 課題: 「課題に設定」をタップしたときに保存 */
  const saveTaskQuestionSetting = useCallback(
    (
      questionModeType: QuestionModeType,
      currentSelectedPracticeSettingIdList?: PracticeQuestionSettingIdList,
      currentSelectedExamSettingIdList?: ExamQuestionSettingIdList,
    ) => {
      // console.log('保存', initialTaskSetting);
      if (!temporaryTaskSetting.taskSetting) return;
      currentSelectedPracticeSettingIdList ??=
        temporaryTaskSetting.practiceQuestionSetting;
      currentSelectedExamSettingIdList ??=
        temporaryTaskSetting.examQuestionSetting;
      const newPracticeQusetionSetting: SettingCardData = {
        ...temporaryTaskSetting,
        questionMode: questionMode.practice,
        practiceQuestionSetting: currentSelectedPracticeSettingIdList,
        examQuestionSetting: initialTaskSetting.examQuestionSetting,
        taskSetting: {
          ...temporaryTaskSetting.taskSetting,
          hasTask: true,
          isAbleToAnswerAfterDeadline: true,
          isExpired: false,
        },
        isQaa:
          currentSelectedPracticeSettingIdList.questionFormat[0] ===
          initialPracticeQuestionSetting.questionFormat[1].id,
      };

      const newExamQuestionSetting: SettingCardData = {
        ...temporaryTaskSetting,
        questionMode: questionMode.exam,
        practiceQuestionSetting: initialTaskSetting.practiceQuestionSetting,
        examQuestionSetting: currentSelectedExamSettingIdList,
        taskSetting: {
          ...temporaryTaskSetting.taskSetting,
          hasTask: true,
          isAbleToAnswerAfterDeadline: true,
          isExpired: false,
        },
      };

      // 練習か模擬試験かで処理を分ける
      if (questionModeType === questionMode.practice) {
        setTemporaryPracticeQuestionSetting(
          currentSelectedPracticeSettingIdList,
        );
        if (calendarTaskSettingMode === taskSettingMode.save) {
          setTemporaryTaskSetting(newPracticeQusetionSetting);
        } else {
          autoSaveTaskSetting(newPracticeQusetionSetting);
          console.log('練習の設定を上書き保存');
        }

        setQuestionInfosByCardData(newPracticeQusetionSetting);
      } else if (questionModeType === questionMode.exam) {
        setTemporaryExamQuestionSetting(currentSelectedExamSettingIdList);
        if (calendarTaskSettingMode === taskSettingMode.save) {
          setTemporaryTaskSetting(newExamQuestionSetting);
        } else {
          autoSaveTaskSetting(newExamQuestionSetting);
          console.log('模擬試験の設定を上書き保存');
        }

        setQuestionInfosByCardData(newExamQuestionSetting);
      }

      // temporaryTaskSetting.id
    },
    [
      setQuestionInfosByCardData,
      temporaryTaskSetting,
      initialTaskSetting,
      initialPracticeQuestionSetting,
      calendarTaskSettingMode,
      setTemporaryTaskSetting,
      setTemporaryPracticeQuestionSetting,
      setTemporaryExamQuestionSetting,
      autoSaveTaskSetting,
    ],
  );

  /** 課題: リセット */
  const resetTaskQuestionSetting = useCallback(() => {
    if (!temporaryTaskSetting.taskSetting) return;
    const newSetting = {
      ...temporaryTaskSetting,
      practiceQuestionSetting: initialTaskSetting.practiceQuestionSetting,
      examQuestionSetting: initialTaskSetting.examQuestionSetting,
      taskSetting: {
        ...temporaryTaskSetting.taskSetting,
        hasTask: false,
        isAbleToAnswerAfterDeadline: undefined,
        isExpired: undefined,
      },
    };
    if (calendarTaskSettingMode === taskSettingMode.save) {
      setTemporaryTaskSetting(newSetting);
    } else {
      autoSaveTaskSetting(newSetting);
      console.log('問題設定をリセットして上書き保存');
    }
  }, [
    temporaryTaskSetting,
    initialTaskSetting,
    calendarTaskSettingMode,
    setTemporaryTaskSetting,
    autoSaveTaskSetting,
  ]);

  /** 色: 選択時に保存 */
  const saveTaskColor = useCallback(
    (color: TaskCalendarColor) => {
      if (!temporaryTaskSetting.taskSetting) return;
      const newTaskSetting: SettingCardData = {
        ...temporaryTaskSetting,
        taskSetting: {
          ...temporaryTaskSetting.taskSetting,
          taskCalendarColor: color,
        },
      };
      if (
        isEqual(
          saveTaskSettingRef.current?.taskColor,
          newTaskSetting.taskSetting?.taskCalendarColor,
        )
      )
        return;

      if (
        calendarTaskSettingMode === taskSettingMode.save &&
        temporaryTaskSetting.taskSetting
      ) {
        setTemporaryTaskSetting(newTaskSetting);
      } else {
        autoSaveTaskSetting(newTaskSetting);
        console.log('色を上書き保存');
      }
    },
    [
      calendarTaskSettingMode,
      temporaryTaskSetting,
      setTemporaryTaskSetting,
      autoSaveTaskSetting,
      saveTaskSettingRef,
    ],
  );

  /** メモ: テキスト変更 */
  const handleChangeTaskMemo = useCallback(
    (text: string) => {
      if (!temporaryTaskSetting.taskSetting) return;
      const newSetting: SettingCardData = {
        ...temporaryTaskSetting,
        taskSetting: {
          ...temporaryTaskSetting.taskSetting,
          taskMemo: text,
        },
      };
      if (isEqual(newSetting, temporaryTaskSetting)) return;
      setTemporaryTaskSetting(newSetting);
    },
    [temporaryTaskSetting, setTemporaryTaskSetting],
  );

  /** メモ: 編集モードでフォーカスが外れた時に上書き保存 */
  const saveTaskMemo = useCallback(() => {
    // console.log('currentTaskSettingCardId', currentTaskSettingCardId);
    if (currentTaskSettingCardId === undefined) return;
    if (!taskSettingList[currentTaskSettingCardId].taskSetting) return;
    if (temporaryTaskSetting.taskSetting === undefined) return;
    const isEditMode = calendarTaskSettingMode === taskSettingMode.edit;
    const taskSetting = taskSettingList[currentTaskSettingCardId]?.taskSetting;
    const isTitleChanged =
      taskSetting &&
      taskSetting.taskMemo !== temporaryTaskSetting.taskSetting.taskMemo;
    if (isEditMode && isTitleChanged) {
      autoSaveTaskSetting(temporaryTaskSetting);
      console.log('メモを上書き保存');
    }
  }, [
    calendarTaskSettingMode,
    currentTaskSettingCardId,
    taskSettingList,
    temporaryTaskSetting,
    autoSaveTaskSetting,
  ]);

  /** 全体: 課題モードの初期化 */
  const initializeCalendarTaskSetting = useCallback(
    (cardData: SettingCardData, id: string, callBack: () => void) => {
      setIsInCalendarTaskSetting(true); // 課題モードかどうか
      setCalendarTaskSettingMode(taskSettingMode.edit);
      setTemporaryTaskSetting(cardData);
      setCurrentTaskSettingCardId(id);
      if (cardData.taskSetting?.hasTask) setQuestionInfosByCardData(cardData);
      if (cardData.questionMode === questionMode.practice) {
        setTemporaryPracticeQuestionSetting(cardData.practiceQuestionSetting);
      } else {
        setTemporaryExamQuestionSetting(cardData.examQuestionSetting);
      }

      callBack();
      /*
            navigation.navigate('ModalStack', {
        userId: allScreenIdList.ModalStack,
        screen: 'CalendarTaskSetting',
        params: {
          userId: allScreenIdList.CalendarTaskSetting,
          isReloadCurrentSettingId: false,
        },
      });

      */
    },
    [
      setIsInCalendarTaskSetting,
      setCalendarTaskSettingMode,
      setTemporaryTaskSetting,
      setCurrentTaskSettingCardId,
      setTemporaryPracticeQuestionSetting,
      setTemporaryExamQuestionSetting,
      setQuestionInfosByCardData,
    ],
  );

  return {
    handleChangeTitle,
    saveTaskTitle,
    saveTaskDate,
    saveTaskQuestionSetting,
    resetTaskQuestionSetting,
    saveTaskColor,
    handleChangeTaskMemo,
    saveTaskMemo,
    initializeCalendarTaskSetting,
  };
};

export default useSettingHandlers;

import {useCallback, useContext, useMemo, useRef, useState} from 'react';
import _, {isEqual} from 'lodash';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {Timestamp} from '@react-native-firebase/firestore';
import {
  type SettingCardData,
  GlobalSaveDataContext,
} from '../../../../hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '../../../../hooks/useGlobalUserSettingContext';
import {
  ButtonStates,
  type ButtonStateType,
} from '../../../../hooks/useButtonContext';
import {CalendarViewContext} from '../useCalendarViewContext';
import {
  questionMode,
  questionSettingState,
  questionState,
  taskAuthor,
  type TaskCalendarColor,
  taskCalendarColor,
  taskSettingMode,
  type TaskSettingModeType,
} from '../../../../../types/commonUnionType';
import {
  type ExamQuestionSettingIdList,
  type PracticeQuestionSettingIdList,
  QuestionSettingViewContext,
} from '../../../../hooks/useQuestionSettingViewContext';
import {getCheckedCategoryString} from '../../../../functionals/getCheckedCategoryString';
import {InitialSettingDataContext} from '../../../../hooks/useInitialSettingDataContext';
import {getJapanDayBoundary} from '../../../../functionals/timeManager';

export type SaveTaskSettingRefType = {
  title: string;
  taskDate?: Array<{
    startAt: FirebaseFirestoreTypes.Timestamp;
    endAt: FirebaseFirestoreTypes.Timestamp;
  }>;
  taskColor: TaskCalendarColor;
};

export type SaveTaskSetting = {
  calendarTaskSettingMode: TaskSettingModeType;
  setCalendarTaskSettingMode: React.Dispatch<
    React.SetStateAction<TaskSettingModeType>
  >;
  initialTaskSetting: SettingCardData;
  currentTaskSettingCardId: string | undefined;
  setCurrentTaskSettingCardId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  temporaryTaskSetting: SettingCardData;
  setTemporaryTaskSetting: React.Dispatch<
    React.SetStateAction<SettingCardData>
  >;
  temporaryPracticeQuestionSetting: PracticeQuestionSettingIdList;
  setTemporaryPracticeQuestionSetting: React.Dispatch<
    React.SetStateAction<PracticeQuestionSettingIdList>
  >;
  temporaryExamQuestionSetting: ExamQuestionSettingIdList;
  setTemporaryExamQuestionSetting: React.Dispatch<
    React.SetStateAction<ExamQuestionSettingIdList>
  >;
  isEqualToInitialSetting: boolean;
  isDefaultTitle: boolean;
  setIsDefaultTitle: React.Dispatch<React.SetStateAction<boolean>>;
  saveTaskSettingRef: React.RefObject<SaveTaskSettingRefType | null>;
  saveTaskSetting: () => Promise<void>;
  autoSaveTaskSetting: (data: SettingCardData) => void;
  taskSaveButtonState: ButtonStateType;
  taskStrings: string[];
};

const useSaveTaskSetting: () => SaveTaskSetting = () => {
  const {addSavedSettingList} = useContext(GlobalSaveDataContext);
  const {grade} = useContext(GlobalUserSettingContext);
  const {homeCalendarSelectedDateObj} = useContext(CalendarViewContext);
  const {
    getPracticeOtherSettingString,
    setQuestionInfosByCardData,
    questionCategoryCommonButtonList,
  } = useContext(QuestionSettingViewContext);
  const {
    idToCheckedButtonInfoList,
    initialExamSubjectButtonInfoList,
    getExamNumberOfQuestionsButtonInfoList,
  } = useContext(InitialSettingDataContext);

  /** 課題カレンダーのモード */
  const [calendarTaskSettingMode, setCalendarTaskSettingMode] =
    useState<TaskSettingModeType>(taskSettingMode.save);

  /** temporaryTaskSettingの初期値 */
  const initialTaskSetting: SettingCardData = useMemo(() => {
    if (!grade) throw new Error('grade is not defined');
    const startOfDay = Timestamp.fromDate(
      getJapanDayBoundary(homeCalendarSelectedDateObj, 'start'),
    );
    const endOfDay = Timestamp.fromDate(
      getJapanDayBoundary(homeCalendarSelectedDateObj, 'end'),
    );
    /*
    console.log(
      'initialTaskSetting: startOfDay',
      startOfDay.toDate().toISOString(),
      'endOfDay',
      endOfDay.toDate().toISOString(),
      'homeCalendarSelectedYmd',
      homeCalendarSelectedYmd,
    );
    */

    return {
      id: '',
      grade,
      title: `課題`,
      settingState: questionSettingState.task,
      questionMode: questionMode.practice,
      practiceQuestionSetting: {
        qaaQuestionCategory: [],
        questionCategory: [],
        questionFormat: [],
        questionOrder: [],
        questionDifficulties: [],
        questionCoverage: [],
        option: [],
        numberOfQuestions: [],
        questionTime: [],
      },
      examQuestionSetting: {
        subject: [],
        numberOfQuestions: [],
      },
      isQaa: false,
      taskSetting: {
        isTeacher: false,
        taskState: questionState.notStarted,
        author: taskAuthor.user,
        taskDate: [
          {
            startAt: startOfDay,
            endAt: endOfDay,
          },
        ],
        isAbleToAnswerAfterDeadline: undefined,
        isExpired: undefined,
        taskNotification: false,
        taskCalendarColor: taskCalendarColor.workbookBlue,
        taskMemo: '',
        hasTask: false,
      },
    };
  }, [grade, homeCalendarSelectedDateObj]);

  /** 現在の課題id */
  const [currentTaskSettingCardId, setCurrentTaskSettingCardId] = useState<
    string | undefined
  >(undefined);

  /*
  useEffect(() => {
    if (!currentTaskSettingCardId) return;
    console.log(
      'taskSettingList[currentTaskSettingCardId]',
      taskSettingList[currentTaskSettingCardId],
    );
  }, [taskSettingList, currentTaskSettingCardId]);
  */

  /** 課題設定の一時保存データ */
  const [temporaryTaskSetting, setTemporaryTaskSetting] =
    useState<SettingCardData>(initialTaskSetting);

  /** 問題設定の一時保存データ */
  const [
    temporaryPracticeQuestionSetting,
    setTemporaryPracticeQuestionSetting,
  ] = useState<PracticeQuestionSettingIdList>(
    initialTaskSetting.practiceQuestionSetting,
  );
  const [temporaryExamQuestionSetting, setTemporaryExamQuestionSetting] =
    useState<ExamQuestionSettingIdList>(initialTaskSetting.examQuestionSetting);

  /** 初期設定から編集されているかどうか */
  const isEqualToInitialSetting = useMemo(() => {
    return _.isEqual(temporaryTaskSetting, initialTaskSetting);
  }, [temporaryTaskSetting, initialTaskSetting]);

  /** デフォルトの場合はタイトルの日付を更新 */
  const [isDefaultTitle, setIsDefaultTitle] = useState<boolean>(true);

  /*
  useEffect(() => {
    console.log('temporaryTaskSetting', temporaryTaskSetting);
  }, [temporaryTaskSetting]);
  */

  /** 課題設定が保存可能か */
  const canSaveTaskSetting = useMemo(() => {
    if (temporaryTaskSetting.title === undefined) return false;
    const hasTitle = /\S/.test(temporaryTaskSetting.title);
    if (hasTitle) {
      return true;
    }

    return false;
  }, [temporaryTaskSetting.title]);

  /** 保存ボタンの状態 */
  const taskSaveButtonState = useMemo(() => {
    if (
      canSaveTaskSetting &&
      temporaryTaskSetting.taskSetting?.taskState !== questionState.completed
    ) {
      return ButtonStates.released;
    }

    return ButtonStates.disabled;
  }, [canSaveTaskSetting, temporaryTaskSetting]);

  const saveTaskSettingRef = useRef<SaveTaskSettingRefType | null>(null);

  /** 課題設定を保存 */
  const saveTaskSetting = useCallback(async () => {
    if (!grade) throw new Error('grade is not defined');
    if (!temporaryTaskSetting)
      throw new Error('temporaryTaskSetting is not defined');
    if (!temporaryTaskSetting.title) throw new Error('title is not defined');
    if (
      temporaryTaskSetting.taskSetting?.author === taskAuthor.user &&
      !temporaryTaskSetting.taskSetting?.taskDate
    )
      throw new Error('taskDate is not defined');
    if (
      temporaryTaskSetting.taskSetting?.author !== taskAuthor.user &&
      !temporaryTaskSetting.taskSetting?.deadlineDate
    )
      throw new Error('deadlineDate is not defined');

    const ref: SaveTaskSettingRefType = {
      title: temporaryTaskSetting.title,
      taskDate: temporaryTaskSetting.taskSetting.taskDate,
      taskColor: temporaryTaskSetting.taskSetting.taskCalendarColor,
    };

    if (isEqual(saveTaskSettingRef.current, ref)) return;
    saveTaskSettingRef.current = ref;
    await addSavedSettingList(temporaryTaskSetting).catch((error: unknown) => {
      console.error('saveTaskSetting：処理失敗', error);
      throw new Error('Failed to save setting');
    });
  }, [temporaryTaskSetting, grade, addSavedSettingList]);

  /** 課題設定を自動で保存 */
  const autoSaveTaskSetting = useCallback(
    (data: SettingCardData) => {
      const saveData = data ?? temporaryTaskSetting;
      if (!grade) throw new Error('grade is not defined');
      if (!saveData) throw new Error('temporaryTaskSetting is not defined');
      if (!saveData.title) throw new Error('title is not defined');
      if (
        saveData.taskSetting?.author === taskAuthor.user &&
        !saveData.taskSetting?.taskDate
      )
        throw new Error('taskDate is not defined');
      if (
        saveData.taskSetting?.author !== taskAuthor.user &&
        !saveData.taskSetting?.deadlineDate
      )
        throw new Error('deadlineDate is not defined');
      if (saveData.taskSetting?.taskDate === null)
        throw new Error('taskDate is not defined');
      const ref: SaveTaskSettingRefType = {
        title: saveData.title,
        taskDate: saveData.taskSetting.taskDate,
        taskColor: saveData.taskSetting.taskCalendarColor,
      };

      saveTaskSettingRef.current = ref;

      setTemporaryTaskSetting(saveData);
      if (saveData.taskSetting?.hasTask) {
        setQuestionInfosByCardData(saveData);
      }

      addSavedSettingList(saveData).catch((error: unknown) => {
        console.error('autoSaveTaskSetting：処理失敗', error);
        throw new Error('Failed to save setting');
      });
    },
    [
      temporaryTaskSetting,
      grade,
      addSavedSettingList,
      setQuestionInfosByCardData,
    ],
  );

  /** 表示する文字列 */
  /** 練習カテゴリ―の文字列 */
  const practiceCategoryString = useMemo(() => {
    //    const currentCategoryData = getCategoryData(temporaryTaskSetting.isQaa);
    const questionCategory = temporaryTaskSetting.isQaa
      ? temporaryPracticeQuestionSetting.qaaQuestionCategory
      : temporaryPracticeQuestionSetting.questionCategory;
    const string = getCheckedCategoryString(
      questionCategory,
      questionMode.practice,
      questionCategoryCommonButtonList.buttonList,
    );
    return string;
  }, [
    temporaryTaskSetting,
    temporaryPracticeQuestionSetting,
    questionCategoryCommonButtonList.buttonList,
  ]);
  /**  練習のその他の文字列 */
  const practiceOtherString = useMemo(() => {
    return getPracticeOtherSettingString(temporaryPracticeQuestionSetting);
  }, [temporaryPracticeQuestionSetting, getPracticeOtherSettingString]);

  /** 模擬試験学科の文字列 */
  const examSubjectString = useMemo(() => {
    if (!temporaryExamQuestionSetting.subject[0]) return '';
    const subjectString = idToCheckedButtonInfoList(
      temporaryExamQuestionSetting.subject[0],
      initialExamSubjectButtonInfoList,
    )[0].name;
    // console.log('subjectString', subjectString);
    return subjectString;
  }, [
    temporaryExamQuestionSetting,
    initialExamSubjectButtonInfoList,
    idToCheckedButtonInfoList,
  ]);

  /**  模擬試験問題数の文字列 */
  const examNumberString = useMemo(() => {
    if (
      !temporaryExamQuestionSetting.subject[0] ||
      !temporaryExamQuestionSetting.numberOfQuestions[0]
    )
      return '';
    const pattern = /eqs_\d級_(subject.+)/g;
    const subject = temporaryExamQuestionSetting.subject[0].replaceAll(
      pattern,
      '$1',
    );
    const subjectButtonInfo = getExamNumberOfQuestionsButtonInfoList(subject);
    const numberOfQuestionString = idToCheckedButtonInfoList(
      temporaryExamQuestionSetting.numberOfQuestions[0],
      subjectButtonInfo,
    )[0].name;
    return numberOfQuestionString;
  }, [
    temporaryExamQuestionSetting,
    getExamNumberOfQuestionsButtonInfoList,
    idToCheckedButtonInfoList,
  ]);

  /**  問題設定に表示する文字列 */
  const taskStrings = useMemo(() => {
    if (temporaryTaskSetting.questionMode === questionMode.practice) {
      return [practiceCategoryString, practiceOtherString];
    }

    return [examSubjectString, examNumberString];
  }, [
    practiceCategoryString,
    examSubjectString,
    practiceOtherString,
    examNumberString,
    temporaryTaskSetting,
  ]);

  return {
    calendarTaskSettingMode,
    setCalendarTaskSettingMode,
    initialTaskSetting,
    currentTaskSettingCardId,
    setCurrentTaskSettingCardId,
    temporaryTaskSetting,
    setTemporaryTaskSetting,
    temporaryPracticeQuestionSetting,
    setTemporaryPracticeQuestionSetting,
    temporaryExamQuestionSetting,
    setTemporaryExamQuestionSetting,
    isEqualToInitialSetting,
    isDefaultTitle,
    setIsDefaultTitle,
    taskSaveButtonState,
    saveTaskSettingRef,
    saveTaskSetting,
    autoSaveTaskSetting,
    taskStrings,
  };
};

export default useSaveTaskSetting;

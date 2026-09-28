import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type ButtonInfoList,
  CheckButtonStates,
  useCheckedButtonList,
} from '@hooks/useCheckButtonContext';
import {taskSettingModalStates} from 'commonUnionType';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import useTask, {type TaskMode} from './useTask';
import {ModalManagerContext} from '@/components/hooks/useModalManagerContext';
import {
  GlobalSaveDataContext,
  type SettingCardData,
} from '@/components/hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '@/components/hooks/useGlobalUserSettingContext';
import {allScreenIdList, type QuestionViewsProps} from '@/types/viewParameter';
import {QuestionSettingViewContext} from '@/components/hooks/useQuestionSettingViewContext';

export const secondaryTaskTabButtonInfoList: ButtonInfoList = [
  {
    id: '未完了',
    name: '未完了',
    initialState: CheckButtonStates.checked,
  },
  {
    id: '完了',
    name: '完了',
    initialState: CheckButtonStates.unchecked,
  },
  {
    id: 'すべて',
    name: 'すべて',
    initialState: CheckButtonStates.unchecked,
  },
];

type SecondaryTaskTabButtonList = {
  set: React.Dispatch<React.SetStateAction<ButtonInfoList>>;
  checked: ButtonInfoList;
};

type TaskModeViewContextObject = {
  hasNewTask?: boolean;
  routes: Array<{key: string; title: string}>;
  index: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  secondaryTaskTabButtonList: {
    today: SecondaryTaskTabButtonList;
    user: SecondaryTaskTabButtonList;
    teacher: SecondaryTaskTabButtonList;
  };
  selectedTaskId: string;
  setSelectedTaskId: (id: string) => void;
  onPressOutTaskSettingCard: (
    id: string,
    cardData?: SettingCardData | null,
  ) => void;
  // taskSettingCardList: TaskSettingCardList;
  selectedTaskData: SettingCardData | null;
} & TaskMode;

type Props = {
  readonly children: ReactNode;
  readonly hasNewTask?: boolean;
};

export const TaskModeViewContext = createContext<TaskModeViewContextObject>(
  {} as TaskModeViewContextObject,
);

const TaskModeViewContextProvider = (props: Props) => {
  const navigation =
    useNavigation<QuestionViewsProps<'TaskMode'>['navigation']>();
  const isFocused = useIsFocused();
  const {readyForTest} = useContext(GlobalUserSettingContext);
  const {savedSettingList} = useContext(GlobalSaveDataContext);
  const {showModal} = useContext(ModalManagerContext);
  const {setCurrentSettingId} = useContext(QuestionSettingViewContext);
  const hasNewTask: boolean = useMemo(() => {
    return props.hasNewTask ?? false;
  }, [props.hasNewTask]);
  const [selectedTaskId, _setSelectedTaskId] = useState<string>('');
  const [selectedTaskData, _setSelectedTaskData] =
    useState<SettingCardData | null>(null);
  const setSelectedTaskId = useCallback(
    (id: string) => {
      _setSelectedTaskId(id);
      _setSelectedTaskData(savedSettingList[id] ?? null);
    },
    [savedSettingList],
  );

  const [index, setIndex] = useState(0);

  const [routes] = useState<Array<{key: string; title: string}>>([
    {key: 'today', title: '今日'},
    {key: 'user', title: 'あなた'},
    {key: 'teacher', title: '講師からの課題'},
  ]);

  const [todayCheckedButtonInfoList, setTodayCheckedButtonInfoList] =
    useCheckedButtonList(secondaryTaskTabButtonInfoList);
  const [userCheckedButtonInfoList, setUserCheckedButtonInfoList] =
    useCheckedButtonList(secondaryTaskTabButtonInfoList);
  const [teacherCheckedButtonInfoList, setTeacherCheckedButtonInfoList] =
    useCheckedButtonList(secondaryTaskTabButtonInfoList);

  const secondaryTaskTabButtonList: {
    today: SecondaryTaskTabButtonList;
    user: SecondaryTaskTabButtonList;
    teacher: SecondaryTaskTabButtonList;
  } = useMemo(() => {
    return {
      today: {
        set: setTodayCheckedButtonInfoList,
        checked: todayCheckedButtonInfoList,
      },
      user: {
        set: setUserCheckedButtonInfoList,
        checked: userCheckedButtonInfoList,
      },
      teacher: {
        set: setTeacherCheckedButtonInfoList,
        checked: teacherCheckedButtonInfoList,
      },
    };
  }, [
    todayCheckedButtonInfoList,
    userCheckedButtonInfoList,
    teacherCheckedButtonInfoList,
    setTodayCheckedButtonInfoList,
    setUserCheckedButtonInfoList,
    setTeacherCheckedButtonInfoList,
  ]);
  const onPressOutTaskSettingCard = useCallback(
    (id: string, cardData?: SettingCardData | null) => {
      if (!cardData) return;
      if (!id) return;

      setSelectedTaskId(id);
      setCurrentSettingId(id);
      showModal(taskSettingModalStates.viewModal);
    },
    [showModal, setSelectedTaskId, setCurrentSettingId],
  );

  const taskMode = useTask({onPressOutTaskSettingCard});

  // テスト開始チェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    console.log('テスト開始チェック', readyForTest);
    if (!readyForTest.isComplete) return;
    // navigation.getParent()?.setOptions({tabBarStyle: {display: 'none'}});
    navigation
      .getParent()
      ?.getParent()
      ?.navigate('Test', {
        userId: allScreenIdList.Test,
        screen: 'QuestionAndChoicesView',
        params: {
          userId: allScreenIdList.QuestionAndChoicesView,
        },
      });
  }, [readyForTest.isComplete]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      ...taskMode,
      hasNewTask,
      routes,
      index,
      setIndex,
      secondaryTaskTabButtonList,
      selectedTaskId,
      setSelectedTaskId,
      onPressOutTaskSettingCard,
      selectedTaskData,
    };
  }, [
    hasNewTask,
    routes,
    index,
    setIndex,
    secondaryTaskTabButtonList,
    selectedTaskId,
    onPressOutTaskSettingCard,
    setSelectedTaskId,
    selectedTaskData,
    taskMode,
  ]);

  return (
    <TaskModeViewContext.Provider value={value}>
      {props.children}
    </TaskModeViewContext.Provider>
  );
};

export default TaskModeViewContextProvider;

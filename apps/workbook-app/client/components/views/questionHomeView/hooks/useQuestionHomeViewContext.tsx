import {createContext, useContext, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {
  getExpiredTaskSettingCardPropsList,
  getInCompleteTaskSettingCardPropsList,
  getTodayAllTaskSettingCardPropsList,
} from '../../../functionals/sortTaskSetting';
import {taskPrimaryTab} from '../../../../types/commonUnionType';
import {TaskDataContext} from '../../../hooks/useTaskDataContext';

export const pressMode = {
  practice: 'practice',
  exam: 'exam',
  saved: 'saved',
  previous: 'previous',
} as const;
export type PressModeType = (typeof pressMode)[keyof typeof pressMode];

type QuestionHomeViewContextObject = {
  onPressOutMode: PressModeType | undefined;
  setOnPressOutMode: (mode: PressModeType | undefined) => void;
  todayTaskSettinIdList: string[];
};

type Props = {
  readonly children: ReactNode;
};

export const QuestionHomeViewContext =
  createContext<QuestionHomeViewContextObject>(
    {} as QuestionHomeViewContextObject,
  );

export const QuestionHomeViewContextProvider = (props: Props) => {
  const {taskSettingListArray} = useContext(TaskDataContext);

  // 中断データモーダル表示前に選択したモードを設定
  const [onPressOutMode, setOnPressOutMode] = useState<
    PressModeType | undefined
  >(undefined);

  // 今日の未完了課題＋期限切れで提出可能な課題を取得
  const todayTaskSettinIdList: string[] = useMemo(() => {
    const todayList = getTodayAllTaskSettingCardPropsList(taskSettingListArray);
    return getInCompleteTaskSettingCardPropsList(todayList)
      .concat(
        getExpiredTaskSettingCardPropsList(
          taskSettingListArray,
          taskPrimaryTab.today,
        ),
      )
      .map((v) => {
        return v.id;
      });
  }, [taskSettingListArray]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      onPressOutMode,
      setOnPressOutMode,
      todayTaskSettinIdList,
    };
  }, [onPressOutMode, setOnPressOutMode, todayTaskSettinIdList]);

  return (
    <QuestionHomeViewContext.Provider value={value}>
      {props.children}
    </QuestionHomeViewContext.Provider>
  );
};

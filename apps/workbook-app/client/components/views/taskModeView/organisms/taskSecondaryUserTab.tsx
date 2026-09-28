import {useContext, useMemo} from 'react';
import {CheckButtonContextProvider} from '@components/hooks/useCheckButtonContext';
import type {TaskPrimaryTabType} from 'commonUnionType';
import {
  TaskModeViewContext,
  secondaryTaskTabButtonInfoList,
} from '../hooks/useTaskModeViewContext';
import TabContent from '../parts/tabContent';
import {DispayTaskSettingCardList} from '@/components/parts/displaySettingCardList';

type TaskSecondaryUserTabProps = Record<string, never>;

export type TabContentProps = {
  readonly primaryTab: TaskPrimaryTabType;
};

const TaskSecondaryUserTab = (_props: TaskSecondaryUserTabProps) => {
  const {
    secondaryTaskTabButtonList,
    taskSettingCardIdList,
    onPressOutTaskSettingCard,
  } = useContext(TaskModeViewContext);
  // 現在のタブのIDリストのみ取得
  const currentIdList = useMemo(() => {
    const secondaryKey = secondaryTaskTabButtonList.user.checked[0]?.id;
    switch (secondaryKey) {
      case '未完了': {
        return taskSettingCardIdList.user.incomplete;
      }

      case '完了': {
        return taskSettingCardIdList.user.completed;
      }

      case 'すべて': {
        return taskSettingCardIdList.user.all;
      }

      default: {
        return [];
      }
    }
  }, [taskSettingCardIdList, secondaryTaskTabButtonList.user.checked]);

  return (
    <CheckButtonContextProvider
      buttonInfoList={secondaryTaskTabButtonInfoList}
      checkedButtonList={secondaryTaskTabButtonList.user.checked}
      setCheckedButtonList={secondaryTaskTabButtonList.user.set}
    >
      <TabContent>
        <DispayTaskSettingCardList
          list={currentIdList}
          onPressOut={onPressOutTaskSettingCard}
        />
      </TabContent>
    </CheckButtonContextProvider>
  );
};

export default TaskSecondaryUserTab;

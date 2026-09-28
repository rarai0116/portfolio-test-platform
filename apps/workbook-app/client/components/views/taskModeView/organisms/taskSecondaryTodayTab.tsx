import {useContext, useMemo} from 'react';
import {CheckButtonContextProvider} from '@components/hooks/useCheckButtonContext';
import TabContent from '../parts/tabContent';
import {
  TaskModeViewContext,
  secondaryTaskTabButtonInfoList,
} from '../hooks/useTaskModeViewContext';
import {DispayTaskSettingCardList} from '@/components/parts/displaySettingCardList';

type TaskSecondaryTodayTabsListProps = Record<string, never>;

const TaskSecondaryTodayTabs = (_props: TaskSecondaryTodayTabsListProps) => {
  const {
    secondaryTaskTabButtonList,
    taskSettingCardIdList,
    onPressOutTaskSettingCard,
  } = useContext(TaskModeViewContext);

  // 現在のタブのIDリストのみ取得
  const currentIdList = useMemo(() => {
    const secondaryKey = secondaryTaskTabButtonList.today.checked[0]?.id;
    switch (secondaryKey) {
      case '未完了': {
        return taskSettingCardIdList.today.incomplete;
      }

      case '完了': {
        return taskSettingCardIdList.today.completed;
      }

      case 'すべて': {
        return taskSettingCardIdList.today.all;
      }

      default: {
        return [];
      }
    }
  }, [taskSettingCardIdList, secondaryTaskTabButtonList.today.checked]);

  return (
    <CheckButtonContextProvider
      buttonInfoList={secondaryTaskTabButtonInfoList}
      checkedButtonList={secondaryTaskTabButtonList.today.checked}
      setCheckedButtonList={secondaryTaskTabButtonList.today.set}
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

export default TaskSecondaryTodayTabs;

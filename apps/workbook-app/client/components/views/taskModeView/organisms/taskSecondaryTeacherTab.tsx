import {useContext, useMemo} from 'react';
import {CheckButtonContextProvider} from '@components/hooks/useCheckButtonContext';
import {
  TaskModeViewContext,
  secondaryTaskTabButtonInfoList,
} from '../hooks/useTaskModeViewContext';
import TabContent from '../parts/tabContent';
import {DispayTaskSettingCardList} from '@/components/parts/displaySettingCardList';

type TaskSecondaryTeacherTabProps = Record<string, never>;

const TaskSecondaryTeacherTab = (_props: TaskSecondaryTeacherTabProps) => {
  const {
    secondaryTaskTabButtonList,
    taskSettingCardIdList,
    onPressOutTaskSettingCard,
  } = useContext(TaskModeViewContext);
  // 現在のタブのIDリストのみ取得
  const currentIdList = useMemo(() => {
    const secondaryKey = secondaryTaskTabButtonList.teacher.checked[0]?.id;
    switch (secondaryKey) {
      case '未完了': {
        return taskSettingCardIdList.teacher.incomplete;
      }

      case '完了': {
        return taskSettingCardIdList.teacher.completed;
      }

      case 'すべて': {
        return taskSettingCardIdList.teacher.all;
      }

      default: {
        return [];
      }
    }
  }, [taskSettingCardIdList, secondaryTaskTabButtonList.teacher.checked]);

  return (
    <CheckButtonContextProvider
      buttonInfoList={secondaryTaskTabButtonInfoList}
      checkedButtonList={secondaryTaskTabButtonList.teacher.checked}
      setCheckedButtonList={secondaryTaskTabButtonList.teacher.set}
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

export default TaskSecondaryTeacherTab;

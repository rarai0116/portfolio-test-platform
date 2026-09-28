import {useContext, useMemo} from 'react';
import {View} from 'react-native';
import List from '../../../parts/list';
import {AccordionMenuContext} from '../../../hooks/useAccordionMenuContext';
import tw from '../../../../tailwind.custom';
import CalendarIcon from '../../../../assets/svg/calendar_tab-bar-icon.svg';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {taskAuthor} from '../../../../types/commonUnionType';
import {dateFormat, getDateToYmdString} from '../../../functionals/timeManager';
import TaskSettingCalendar from './taskSettingCalendar';

const TaskCalendar = () => {
  const {handleAccordionMenu} = useContext(AccordionMenuContext);
  const {selectedDateObj} = useContext(CustomCalendarContext);
  const {temporaryTaskSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const title = useMemo(() => {
    if (!selectedDateObj[0].start) return '';

    const start = getDateToYmdString(
      selectedDateObj[0].start,
      dateFormat.slash,
      true,
    );

    if (!selectedDateObj[0].end) {
      return `${start}`;
    }

    const end = getDateToYmdString(
      selectedDateObj[0].end,
      dateFormat.slash,
      true,
    );

    if (
      selectedDateObj[0].start.toDateString() ===
      selectedDateObj[0].end.toDateString()
    ) {
      return `${start}`;
    }

    return `${start}～${end}`;
  }, [selectedDateObj]);

  return (
    <View style={tw`w-full items-center`}>
      <View style={tw`w-full`}>
        <List
          hasIcon
          hasAccordionArrow
          hasArrow={false}
          title={title}
          icon={<CalendarIcon fill="#727272" width={16} height={16} />}
          hasAlert={false}
          isDisabled={
            temporaryTaskSetting.taskSetting?.author !== taskAuthor.user
          }
          onPressOut={() => {
            handleAccordionMenu();
          }}
        />

        <TaskSettingCalendar />
      </View>
    </View>
  );
};

export default TaskCalendar;

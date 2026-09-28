import {useContext, useMemo} from 'react';
import {View} from 'react-native';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {AccordionMenuContext} from '../../../hooks/useAccordionMenuContext';
import List from '../../../parts/list';
import tw from '../../../../tailwind.custom';
import PaletteIcon from '../../../../assets/svg/palette_schedule-color-icon.svg';
import TaskColorPalette from './taskColorPalette';

const TaskColor = () => {
  const {temporaryTaskSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );
  const {handleAccordionMenu} = useContext(AccordionMenuContext);

  const color: string = useMemo(() => {
    if (temporaryTaskSetting.taskSetting === undefined) return '';
    return temporaryTaskSetting.taskSetting?.taskCalendarColor;
  }, [temporaryTaskSetting]);

  return (
    <View style={tw`w-full`}>
      <List
        hasIcon
        hasAccordionArrow
        hasArrow={false}
        title={
          <View style={tw`w-5 h-5 flex rounded-full mr-3 mt-0.5 ${color}`} />
        }
        icon={<PaletteIcon />}
        hasAlert={false}
        /* isDisabled={
          temporaryTaskSetting.taskSetting?.author !== taskAuthor.user
        } */
        onPressOut={() => {
          handleAccordionMenu();
        }}
      />
      <View style={tw`w-full items-center`}>
        <TaskColorPalette />
      </View>
    </View>
  );
};

export default TaskColor;

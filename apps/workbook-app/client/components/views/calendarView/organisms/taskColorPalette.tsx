import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import {Pressable} from 'react-native-gesture-handler';
import tw from '../../../../tailwind.custom';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';
import {taskCalendarColor} from '../../../../types/commonUnionType';
import {AccordionMenuContext} from '../../../hooks/useAccordionMenuContext';

export type TaskColorPaletteProps = Record<string, never>;

const TaskColorPalette = (_props: TaskColorPaletteProps) => {
  const {saveTaskColor} = useContext(CalendarTaskSettingViewModalContext);
  const {display} = useContext(AccordionMenuContext);
  const taskColors = useMemo(() => {
    return Object.values(taskCalendarColor).map((color) => {
      return (
        <Pressable
          key={`tkcp-${color}`}
          style={tw`w-5 h-5 flex rounded-full mr-3 mb-2 ${color}`}
          onPressOut={() => {
            saveTaskColor(color);
          }}
        >
          <View />
        </Pressable>
      );
    });
  }, [saveTaskColor]);

  return (
    display === 'flex' && (
      <View style={tw`bg-white w-11/12 pl-12 pr-4 py-2 flex`}>
        <View style={tw`flex-row items-center flex-wrap`}>{taskColors}</View>
      </View>
    )
  );
};

export default TaskColorPalette;

import {
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  FlatList,
} from 'react-native';
import {useCallback, useContext, useMemo, memo} from 'react';
import tw from '../../../../tailwind.custom';
import {AccordionMenuContext} from '../../../hooks/useAccordionMenuContext';
import {CalendarViewContext} from '../hooks/useCalendarViewContext';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import type {CalenderYmData} from '../../../../types/customCalendarTypes';
import {CalendarItem} from './calendarItem';
import CalendarHeader from './calendarHeader';

export type TaskSettingCalendarProps = Record<string, never>;

const MemorizedCalendarItem = memo(CalendarItem, (prevProps, nextProps) => {
  // 比較のロジックを追加
  return (
    prevProps.yearMonth.year === nextProps.yearMonth.year &&
    prevProps.yearMonth.month === nextProps.yearMonth.month
  );
});

const TaskSettingCalendar = (_props: TaskSettingCalendarProps) => {
  const {
    taskCalendarWidth,
    ymData,
    pastScrollRange,
    viewableItemsChanged,
    flashListRef,
    viewConfig,
  } = useContext(CustomCalendarContext);
  const {display} = useContext(AccordionMenuContext);
  const {homeCalendarSelectedDateObj} = useContext(CalendarViewContext);

  const {width} = useWindowDimensions();
  const itemWidth = useMemo(() => {
    return (width * 11) / 12;
  }, [width]);

  const initialSelectedMonth = useMemo(() => {
    return homeCalendarSelectedDateObj.getMonth() + 1;
  }, [homeCalendarSelectedDateObj]);

  const _initialIndex = useMemo(() => {
    return initialSelectedMonth >= 9
      ? initialSelectedMonth - 9
      : 12 + initialSelectedMonth - 9;
  }, [initialSelectedMonth]);

  const items = useCallback(
    ({item}: ListRenderItemInfo<CalenderYmData>) => {
      return (
        <View style={tw`w-[${itemWidth}px] items-center`}>
          <View style={tw`w-[${taskCalendarWidth}px]`}>
            <MemorizedCalendarItem yearMonth={item} width={itemWidth} />
          </View>
        </View>
      );
    },
    [itemWidth, taskCalendarWidth],
  );

  return (
    <View
      style={tw`w-full h-auto items-center flex ${display === 'hidden' ? 'absolute top-[20000] left-[20000]' : ''}`}
    >
      <View style={tw`bg-white`}>
        <CalendarHeader
          buttonColor="#727272"
          headerWidth={itemWidth}
          headerStyle="flex-row justify-between px-3.5 pt-4 pb-4 bg-white"
          textStyle="text-primary text-base"
        />

        <View style={tw`bg-white w-11/12 h-auto`}>
          <FlatList
            ref={flashListRef}
            horizontal
            pagingEnabled
            /* overrideItemLayout={(layout, item, index) => {
              layout.size = itemWidth;
            }} */
            keyExtractor={(item) => `${item.year}-${item.month}`}
            viewabilityConfig={viewConfig}
            scrollEventThrottle={32}
            showsHorizontalScrollIndicator={false}
            data={ymData}
            renderItem={items}
            // estimatedItemSize={itemWidth} // 1つのitemのサイズ
            // FlatList用
            getItemLayout={(_, index) => ({
              length: itemWidth,
              offset: itemWidth * index,
              index,
            })}
            initialScrollIndex={pastScrollRange}
            onViewableItemsChanged={viewableItemsChanged}
          />
        </View>
      </View>
    </View>
  );
};

export default TaskSettingCalendar;

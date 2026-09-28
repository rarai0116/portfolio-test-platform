import {
  useWindowDimensions,
  View,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import {useCallback, useContext, memo} from 'react';
import tw from '../../../../tailwind.custom';
import {CustomCalendarContext} from '../hooks/useCustomCalendarContext';
import {TextInputContextProvider} from '../../../hooks/useTextInputContextProvider';
import type {CalenderYmData} from '../../../../types/customCalendarTypes';
import {CalendarItem} from './calendarItem';
import CalendarHeader from './calendarHeader';
import GoalTextInput from './goalTextInput';

type HomeCalendarProps = Record<string, never>;

const MemorizedCalendarItem = memo(CalendarItem, (prevProps, nextProps) => {
  // 比較のロジックを追加
  return (
    prevProps.yearMonth.year === nextProps.yearMonth.year &&
    prevProps.yearMonth.month === nextProps.yearMonth.month
  );
});

export const HomeCalendar = (_props: HomeCalendarProps) => {
  const {
    ymData,
    pastScrollRange,
    viewableItemsChanged,
    flashListRef,
    viewConfig,
  } = useContext(CustomCalendarContext);
  const width = useWindowDimensions().width;

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<CalenderYmData>) => {
      // console.log('HomeCalendar renderItem', item);
      return (
        <View style={tw`w-[${width}px]`}>
          <MemorizedCalendarItem yearMonth={item} width={width} />
        </View>
      );
    },
    [width],
  );

  return (
    <View style={tw`w-full`}>
      <CalendarHeader />
      <TextInputContextProvider>
        <GoalTextInput />
      </TextInputContextProvider>
      <View style={tw`bg-white w-[${width}px] min-h-1`}>
        <FlatList
          ref={flashListRef}
          horizontal
          pagingEnabled
          keyExtractor={(item) => `${item.year}-${item.month}`}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          showsHorizontalScrollIndicator={false}
          data={ymData}
          renderItem={renderItem}
          // 仮想化を効かせ、表示中の月±1だけマウントする。
          // 旧来は全~12ヶ月がマウントされ、日付選択のたびに全月の全セルが
          // 再レンダしていた(Profilerで View×数千)。getItemLayout があるため
          // 画面外の月はオンデマンドで描画される。
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          // FlatList用
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          initialScrollIndex={pastScrollRange}
          onViewableItemsChanged={viewableItemsChanged}
        />
      </View>
    </View>
  );
};

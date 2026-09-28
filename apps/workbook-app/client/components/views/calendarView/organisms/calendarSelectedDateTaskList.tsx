import {View} from 'react-native';
import {useContext, useMemo, useRef} from 'react';
import {ScrollView} from 'react-native-gesture-handler';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {CalendarViewContext} from '../hooks/useCalendarViewContext';
import Spacer from '../../../parts/spacer';
import DisplayCalendarTaskList from './displayCalendarTaskList';

export type CalendarSelectedDateTaskListProps = Record<string, never>;

const CalendarSelectedDateTaskList = (
  _props: CalendarSelectedDateTaskListProps,
) => {
  const {selectedDateMdw, selectedDateTaskList} =
    useContext(CalendarViewContext);
  const dataBody = useMemo(() => {
    const selectedDateTaskIdList = selectedDateTaskList.map((v) => v.id);
    return selectedDateTaskIdList.length === 0 ? (
      <View style={tw`items-center pt-2`}>
        <AppText style={tw`text-lg text-secondary`}>課題はありません</AppText>
      </View>
    ) : (
      <>
        <DisplayCalendarTaskList
          list={selectedDateTaskIdList}
          scrollRef={scrollRef}
        />
        <Spacer isHorizontal={false} size={80} />
      </>
    );
  }, [selectedDateTaskList]);

  const scrollRef = useRef<ScrollView>(null);

  return (
    <>
      <View style={tw` pt-3 px-6`}>
        <AppText style={tw`text-primary text-lg `}>{selectedDateMdw}</AppText>
      </View>
      <Spacer isHorizontal={false} size={4} />
      <ScrollView ref={scrollRef} style={tw`flex-1`}>
        {dataBody}
      </ScrollView>
    </>
  );
};

export default CalendarSelectedDateTaskList;

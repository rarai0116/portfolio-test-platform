import {View} from 'react-native';
import {memo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {weeks} from '../../../functionals/timeManager';

type CalendarWeekLabelProps = Record<string, never>;

/** 曜日 */
const CalendarWeekLabel = memo((_props: CalendarWeekLabelProps) => {
  // const {getMappingKey} = useMappingHelper();

  return (
    <View style={tw`flex-row`}>
      {weeks.map((v, i) => {
        const key = `week_${i}`;
        const textColor =
          v === '土'
            ? 'text-workbookblue-500'
            : v === '日'
              ? 'text-errorred-400'
              : 'text-primary';

        return (
          <View
            key={key}
            style={tw`w-1/7 h-6 flex items-center justify-center border-b border-b-quaternary`}
          >
            <AppText style={tw`${textColor}`}>{v}</AppText>
          </View>
        );
      })}
    </View>
  );
});

CalendarWeekLabel.displayName = 'CalendarWeekLabel';

export default CalendarWeekLabel;

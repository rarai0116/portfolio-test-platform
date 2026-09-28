import {View} from 'react-native';
import {useContext} from 'react';
import tw from '../../../tailwind.custom';
import AppText from '../../identities/appText';
import Spacer from '../../parts/spacer';
import {timeUnitConverter} from '../../functionals/timeManager';
import {DataAnalysisContext} from './hooks/useDataAnalysisModeContext';
import DataAnalysisBarChart from './parts/dataAnalysisBarChart';

export type DataAnalysisStudyHoursProps = Record<string, never>;

const DataAnalysisStudyHoursView = (_props: DataAnalysisStudyHoursProps) => {
  const {
    consecutiveStudyDays,
    todaysStudyHours,
    totalStudyDays,
    totalStudyHours,
  } = useContext(DataAnalysisContext);

  return (
    <View style={tw`items-center`}>
      <Spacer isHorizontal={false} size={24} />
      <View style={tw`w-11/12 bg-white rounded-md px-6 py-3`}>
        <DataAnalysisBarChart />
      </View>
      <Spacer isHorizontal={false} size={12} />
      <View style={tw`w-11/12 bg-white rounded-md px-6 py-3`}>
        <View style={tw`flex-row justify-between`}>
          <AppText style={tw`text-primary text-base`}>連続勉強日数</AppText>
          <AppText
            style={tw`text-primary text-base`}
          >{`${consecutiveStudyDays}日`}</AppText>
        </View>
        <Spacer isHorizontal={false} size={12} />
        <View style={tw`flex-row justify-between`}>
          <AppText style={tw`text-primary text-base`}>本日の学習時間</AppText>
          <AppText style={tw`text-primary text-base`}>{`${timeUnitConverter(
            todaysStudyHours,
          )}`}</AppText>
        </View>
        <Spacer isHorizontal={false} size={12} />
        <View style={tw`flex-row justify-between`}>
          <AppText style={tw`text-primary text-base`}>
            今まで学習した日数
          </AppText>
          <AppText
            style={tw`text-primary text-base`}
          >{`${totalStudyDays}日`}</AppText>
        </View>
        <Spacer isHorizontal={false} size={12} />
        <View style={tw`flex-row justify-between`}>
          <AppText style={tw`text-primary text-base`}>
            今まで学習した時間
          </AppText>
          <AppText style={tw`text-primary text-base`}>{`${timeUnitConverter(
            totalStudyHours,
          )}`}</AppText>
        </View>
      </View>
    </View>
  );
};

export default DataAnalysisStudyHoursView;

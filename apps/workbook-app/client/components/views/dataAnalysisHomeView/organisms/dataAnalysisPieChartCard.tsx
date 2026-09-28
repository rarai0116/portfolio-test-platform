import {View} from 'react-native';
import {useMemo, useContext} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import DataAnalysisPieChart from '../parts/dataAnalysisPieChart';
import Spacer from '../../../parts/spacer';
import {DataAnalysisContext} from '../hooks/useDataAnalysisModeContext';

export type PieChartDataType = {
  name: string;
  numberOfQuestions: number;
};

export type DataAnalysisPieChartCardProps = {
  readonly data: PieChartDataType[];
};

const DataAnalysisPieChartCard = (props: DataAnalysisPieChartCardProps) => {
  const {getNumberOfQuestionsPercentList} = useContext(DataAnalysisContext);

  const numberOfQuestions: number[] = useMemo(() => {
    return props.data.map((_v, i) => {
      return props.data[i].numberOfQuestions;
    });
  }, [props.data]);

  const legend = useMemo(() => {
    return props.data.map((_v, i) => {
      const key = `pieChart_${i}`;
      const percent = getNumberOfQuestionsPercentList(numberOfQuestions);
      return (
        <View key={key}>
          <AppText style={tw`text-primary text-xs`}>
            {props.data[i].name}
          </AppText>
          <View style={tw`flex-row`}>
            <AppText
              style={tw`text-primary text-base`}
            >{`${percent[i]}%`}</AppText>
            <Spacer isHorizontal size={12} />
            <AppText style={tw`text-primary text-base`}>
              {props.data[i].numberOfQuestions}問
            </AppText>
          </View>
          <Spacer isHorizontal={false} size={12} />
        </View>
      );
    });
  }, [props.data, getNumberOfQuestionsPercentList, numberOfQuestions]);

  return (
    <View
      style={tw`w-11/12 items-center justify-center bg-white rounded-md flex-row py-10`}
    >
      <DataAnalysisPieChart numberOfQuestions={numberOfQuestions} />
      <Spacer isHorizontal size={24} />
      <View style={tw``}>{legend}</View>
    </View>
  );
};

export default DataAnalysisPieChartCard;

import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import {Svg, Circle} from 'react-native-svg';
import tw from '../../../../tailwind.custom';
import {DataAnalysisContext} from '../hooks/useDataAnalysisModeContext';

export type DataAnalysisPieChartProps = {readonly numberOfQuestions: number[]};

const DataAnalysisPieChart = (props: DataAnalysisPieChartProps) => {
  const {getNumberOfQuestionsPercentList} = useContext(DataAnalysisContext);

  const percent = useMemo(() => {
    return getNumberOfQuestionsPercentList(props.numberOfQuestions);
  }, [props.numberOfQuestions, getNumberOfQuestionsPercentList]);

  return (
    <View style={tw`w-40 h-40`}>
      <Svg style={tw``} viewBox="0 0 63.6619772368 63.6619772368">
        <Circle
          cx="31.8309886184"
          cy="31.8309886184"
          r="15.9154943092"
          fill="rgba(0,0,0,0)"
          stroke="#47AAF6"
          strokeWidth="31.8309886184"
          strokeDashoffset="25"
          strokeDasharray={`${percent[0]}, ${100 - percent[0]}`}
        />
        <Circle
          cx="31.8309886184"
          cy="31.8309886184"
          r="15.9154943092"
          fill="rgba(0,0,0,0)"
          stroke="#F9F871"
          strokeWidth="31.8309886184"
          strokeDashoffset="25"
          strokeDasharray={`0,${percent[0]},${percent[1]},${
            100 - (percent[0] + percent[1])
          }`}
        />
        <Circle
          cx="31.8309886184"
          cy="31.8309886184"
          r="15.9154943092"
          fill="rgba(0,0,0,1)"
          stroke="#ECECEC"
          strokeWidth="31.8309886184"
          strokeDashoffset="25"
          strokeDasharray={`0,${percent[0] + percent[1]},${percent[2]},0`}
        />
        <Circle cx="31.8309886184" cy="31.8309886184" r="20" fill="#fff" />
      </Svg>
    </View>
  );
};

export default DataAnalysisPieChart;

import {G, Text, Line} from 'react-native-svg';

type DataAnalysisBarChartTickProps = {
  readonly ukey: string;
  readonly x0: number;
  readonly y: number;
  readonly xAxisLength: number;
  readonly yValue: string;
};

const DataAnalysisBarChartTick = (props: DataAnalysisBarChartTickProps) => {
  return (
    <G key={props.ukey}>
      <Line
        x1={props.x0}
        y1={props.y}
        x2={props.x0 + props.xAxisLength}
        y2={props.y}
        stroke="#ECECEC"
        strokeWidth="2"
      />
      <Text
        x={props.x0 - 5}
        y={props.y + 5}
        fill="#3F3F3F"
        fontSize="12"
        textAnchor="end"
      >
        {props.yValue}
      </Text>
    </G>
  );
};

export default DataAnalysisBarChartTick;

import {G, Text, Line} from 'react-native-svg';

type DataAnalysisTickProps = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly xAxisLength: number;
  readonly yValue: string;
  readonly textColor?: string;
  readonly fontSize?: number;
};

const DataAnalysisTick = (props: DataAnalysisTickProps) => {
  return (
    <G key={props.key}>
      <Line
        x1={props.x}
        y1={props.y}
        x2={props.x + props.xAxisLength}
        y2={props.y}
        stroke="#ECECEC"
        strokeWidth="2"
      />
      <Text
        x={props.x - 5}
        y={props.y + 5}
        fill={props.textColor ?? '#3F3F3F'}
        fontSize={props.fontSize ?? 12}
        textAnchor="end"
      >
        {props.yValue}
      </Text>
    </G>
  );
};

export default DataAnalysisTick;

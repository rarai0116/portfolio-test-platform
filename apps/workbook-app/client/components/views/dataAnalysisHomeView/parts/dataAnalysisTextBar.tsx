import {G, Text, Rect} from 'react-native-svg';

type DataAnalysisTextBarProps = {
  readonly ukey: string;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly textY: number;
  readonly barColor?: string;
  readonly textColor?: string;
  readonly fontSize?: number;
  readonly text: string;
};

const DataAnalysisTextBar = (props: DataAnalysisTextBarProps) => {
  // Implement the logic for the DataAnalysisTextBar component here

  return (
    <G key={props.ukey}>
      <Rect
        x={props.x}
        y={props.y}
        width={props.width}
        height={props.height}
        fill={props.barColor ?? '#47AAF6'}
      />
      <Text
        x={props.x}
        y={props.textY}
        fill={props.textColor ?? '#3F3F3F'}
        fontSize={props.fontSize ?? 12}
        textAnchor="middle"
      >
        {props.text}
      </Text>
    </G>
  );
};

export default DataAnalysisTextBar;

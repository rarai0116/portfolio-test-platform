import {View} from 'react-native';
import {useCallback, useMemo, useContext} from 'react';
import {Svg, Rect, G, Path, Polyline, Text} from 'react-native-svg';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {DataAnalysisContext} from '../hooks/useDataAnalysisModeContext';
import Spacer from '../../../parts/spacer';
import type {
  RadarChartDataItemKey,
  RadarChartGradeOneType,
  RadarChartGradeTwoType,
  RadarChartGradeOneKey,
  RadarChartGradeTwoKey,
  DataAnalysisRadarChartData,
} from '../hooks/useDataAnalysisModeContext/useRaderChartData';
import type {QuestionGradeType} from '../../../../types/commonUnionType';

type RadarChartKeys = RadarChartGradeOneKey | RadarChartGradeTwoKey;
type RadarChartType = {
  [key in RadarChartGradeOneKey | RadarChartGradeTwoKey]: number;
};

export type DataAnalysisRadarChartProps = Record<string, never>;

const getCaption = <T extends QuestionGradeType>(
  grade: T,
  radarChartData: DataAnalysisRadarChartData<
    T extends '1級' ? RadarChartGradeOneType : RadarChartGradeTwoType
  >,
): RadarChartGradeOneKey[] | RadarChartGradeTwoKey[] => {
  return grade === '1級'
    ? (Object.keys(radarChartData.user) as RadarChartGradeOneKey[])
    : (Object.keys(radarChartData.user) as RadarChartGradeTwoKey[]);
};

const DataAnalysisRadarChart = (_props: DataAnalysisRadarChartProps) => {
  const {radarChartData, grade} = useContext(DataAnalysisContext);
  const {
    boxWidth,
    boxHeight,
    numberOfScales,
    userColor,
    goalColor,
  }: {
    boxWidth: number;
    boxHeight: number;
    numberOfScales: number;
    userColor: string;
    goalColor: string;
  } = useMemo(() => {
    return {
      boxWidth: 300,
      boxHeight: 250,
      numberOfScales: 4,
      userColor: '#289Df4',
      goalColor: '#66C365',
    };
  }, []);
  const chartSize = useMemo(() => boxHeight * 0.7, [boxHeight]);
  const captions = useMemo(
    () => getCaption(grade, radarChartData),
    [radarChartData, grade],
  );
  const columns = useMemo<
    Array<{
      key: RadarChartGradeOneKey | RadarChartGradeTwoKey;
      angle: number;
    }>
  >(
    () =>
      captions.map((key, i, all) => {
        return {
          key,
          angle: (Math.PI * 2 * i) / all.length,
        };
      }),
    [captions],
  );

  // 極座標から直交座標を取得 x=rcosθ, y=rsinθ
  const polarToX = useCallback((angle: number, distance: number) => {
    // angle -(Math.PI / 2)で90度ずらす
    return Math.cos(angle - Math.PI / 2) * distance;
  }, []);
  const polarToY = useCallback((angle: number, distance: number) => {
    return Math.sin(angle - Math.PI / 2) * distance;
  }, []);

  const getPathDefinition = useCallback((points: number[][]) => {
    let d = `M${points[0][0].toFixed(4)},${points[0][1].toFixed(4)}`;
    for (let i = 1; i < points.length; i++) {
      d += `L${points[i][0].toFixed(4)},${points[i][1].toFixed(4)}`;
    }

    return `${d}z`;
  }, []);

  // 頂点
  const getPoints = useCallback((points: number[][]) => {
    return points
      .map((point) => `${point[0].toFixed(4)},${point[1].toFixed(4)}`)
      .join(' ');
  }, []);

  // X軸
  const displayScale = useMemo(() => {
    const array = [];
    for (let i = numberOfScales; i > 0; i--) {
      const key = `scale_${i}`;
      array.push(
        <Path
          key={key}
          d={getPathDefinition(
            columns.map((col) => {
              return [
                polarToX(col.angle, ((i / numberOfScales) * chartSize) / 2),
                polarToY(col.angle, ((i / numberOfScales) * chartSize) / 2),
              ];
            }),
          )}
          stroke="#ECECEC"
          fill="#fff"
          strokeWidth={1}
        />,
      );
    }

    return array;
  }, [
    columns,
    chartSize,
    getPathDefinition,
    polarToX,
    polarToY,
    numberOfScales,
  ]);

  // Y軸
  const displayAxis = useMemo(() => {
    return columns.map((col, i) => {
      const key = `poly_axis_${i}`;
      return (
        <Polyline
          key={key}
          points={getPoints([
            [0, 0],
            [
              polarToX(col.angle, chartSize / 2),
              polarToY(col.angle, chartSize / 2),
            ],
          ])}
          stroke="#555"
          strokeWidth=".2"
        />
      );
    });
  }, [chartSize, columns, getPoints, polarToX, polarToY]);

  // グラフ
  const displayShape = useMemo(() => {
    const keys = Object.keys(radarChartData) as RadarChartDataItemKey[];
    return keys.map<React.JSX.Element[]>((key, _i) => {
      const color = key === 'user' ? userColor : goalColor;
      const data = radarChartData[key] as RadarChartType;
      const eachData = Object.values(data);
      return eachData.map((_, i) => {
        const shapeKey = `shape_${i}`;

        return (
          <Path
            key={shapeKey}
            d={getPathDefinition(
              columns.map((col: {key: RadarChartKeys; angle: number}) => {
                const key = col.key;
                const value = data[key];

                return [
                  polarToX(col.angle, (value * chartSize) / 2),
                  polarToY(col.angle, (value * chartSize) / 2),
                ];
              }),
            )}
            stroke={color}
            strokeWidth={2}
            fill="#ffffff"
            fillOpacity="0"
          />
        );
      });
    });
  }, [
    goalColor,
    userColor,
    columns,
    radarChartData,
    chartSize,
    getPathDefinition,
    polarToX,
    polarToY,
  ]);

  const squarePoint = useMemo(() => {
    const keys = Object.keys(radarChartData) as RadarChartDataItemKey[];

    return keys.map((key, _i) => {
      const color = key === 'user' ? userColor : goalColor;
      const data = radarChartData[key] as RadarChartType;
      const eachData = Object.values(data);
      const rectSize = 6;
      return eachData.map((_, i) => {
        const pointKey = `square_${i}`;
        return columns.map((col) => {
          const key = col.key;
          const value = data[key];
          return (
            <Rect
              key={`${pointKey}_${key}`}
              // 正方形の半分の長さ分位置を調整
              x={polarToX(col.angle, (value * chartSize) / 2) - rectSize / 2}
              y={polarToY(col.angle, (value * chartSize) / 2) - rectSize / 2}
              width={rectSize}
              height={rectSize}
              fill={color}
            />
          );
        });
      });
    });
  }, [
    chartSize,
    columns,
    radarChartData,
    polarToX,
    polarToY,
    userColor,
    goalColor,
  ]);

  // 項目
  const displayCaption = useMemo(() => {
    return columns.map((col, _i) => {
      const x = Number(polarToX(col.angle, chartSize / 2).toFixed(4));
      const y = Number(polarToY(col.angle, chartSize / 2).toFixed(4));
      let dx = 0;
      let dy = 5;

      switch (true) {
        case x === 0 && y < 0: {
          // 1級・2級計画
          dx = 0;
          dy = -5;

          break;
        }

        case x > 0 && y < 0: {
          // 1級環境・設備
          dx = 30;

          break;
        }

        case x > 0 && y > 0: {
          // 1級法規
          dx = 20;

          break;
        }

        case x < 0 && y > 0: {
          // 1級構造
          dx = -20;

          break;
        }

        case x < 0 && y < 0: {
          // 1級施工
          dx = -15;

          break;
        }

        case x === 0 && y > 0: {
          // 2級構造
          dx = 0;
          dy = 15;

          break;
        }

        case x > 0 && y === 0: {
          // 2級法規
          dx = 15;

          break;
        }

        case x < 0 && y === 0: {
          // 2級施工
          dx = -15;

          break;
        }

        default: {
          return null;
        }
      }

      return (
        <Text
          key={`caption_${String(col.key)}`}
          x={x}
          y={y}
          dx={dx}
          dy={dy}
          fill="#727272"
          textAnchor="middle"
          fontSize={12}
        >
          {String(col.key)}
        </Text>
      );
    });
  }, [columns, chartSize, polarToX, polarToY]);

  return (
    <View style={tw`w-full items-center`}>
      <Svg
        width={boxWidth}
        height={boxHeight}
        viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      >
        <G
          transform={`translate(${(boxWidth / 2).toFixed(4)},${(
            boxHeight / 2
          ).toFixed(4)})`}
        >
          <G key="scales">{displayScale}</G>
          <G key="group_axis">{displayAxis}</G>
          <G key="group_shape">{displayShape}</G>
          <G key="group_point">{squarePoint}</G>
          <G key="group_captions">{displayCaption}</G>
        </G>
      </Svg>
      <View style={tw`flex-row`}>
        <View style={tw`flex-row items-center`}>
          <View style={tw`w-1.5 h-1.5 bg-[${userColor}]`} />
          <Spacer isHorizontal size={8} />
          <AppText>あなた</AppText>
        </View>
        <Spacer isHorizontal size={12} />
        <View style={tw`flex-row items-center`}>
          <View style={tw`w-1.5 h-1.5 bg-[${goalColor}]`} />
          <Spacer isHorizontal size={8} />
          <AppText>目標</AppText>
        </View>
      </View>
    </View>
  );
};

export default DataAnalysisRadarChart;

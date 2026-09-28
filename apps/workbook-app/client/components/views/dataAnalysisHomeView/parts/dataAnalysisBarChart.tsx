import {useWindowDimensions} from 'react-native';
import {useMemo, useContext} from 'react';
import {Svg, Line, Text} from 'react-native-svg';
import {Timestamp} from '@react-native-firebase/firestore';
import {getMdString, getTodayTimestamp} from '../../../functionals/timeManager';
import {DataAnalysisContext} from '../hooks/useDataAnalysisModeContext';
import DataAnalysisTextBar from './dataAnalysisTextBar';
import DataAnalysisBarChartTick from './dataAnalysisBarChartTick';

type DataAnalysisBarChartProps = Record<string, never>;

type SandardTimeType = '時間' | '分';

// 1時間をミリ秒で表した時の値
const _hourMs = 3_600_000;
// １分をミリ秒で表した時の値
const _minuteMs = 60_000;

const DataAnalysisBarChart = (_props: DataAnalysisBarChartProps) => {
  const {weeklyStudyHourList, weeklyMaxStudyHour} =
    useContext(DataAnalysisContext);

  const {width} = useWindowDimensions();
  const {
    svgWidth,
    svgHeight,
    x0,
    xAxisLength,
    y0,
    yAxisLength,
    xAxisY,
    numberYticks,
  } = useMemo(() => {
    const svgWidth = (width * 10) / 12;
    const svgHeight = 200;
    const x0 = 35;
    const xAxisLength = svgWidth - x0 * 2;
    const y0 = 20;
    const yAxisLength = svgHeight - y0 * 2;
    const xAxisY = y0 + yAxisLength;
    const numberYticks = 3;
    //    const yAxisMax = 3_600_000; // 60分
    return {
      svgWidth,
      svgHeight,
      x0,
      xAxisLength,
      y0,
      yAxisLength,
      xAxisY,
      numberYticks,
      //      yAxisMax,
    };
  }, [width]);

  const {yAxisMax, standardTimeType} = useMemo(() => {
    // maxValueが3時間未満の場合は分単位で表示
    const standardTimeType: SandardTimeType =
      weeklyMaxStudyHour >= 3 * _hourMs ? '時間' : '分';
    switch (true) {
      // 15分以下の場合
      case weeklyMaxStudyHour <= 15 * _minuteMs: {
        return {
          yAxisMax: 15 * _minuteMs,
          standardTimeType,
        };
      }

      // 30分以下の場合
      case weeklyMaxStudyHour <= 30 * _minuteMs: {
        return {
          yAxisMax: 30 * _minuteMs,
          standardTimeType,
        };
      }

      // 60分以下の場合
      case weeklyMaxStudyHour <= 60 * _minuteMs: {
        return {
          yAxisMax: 60 * _minuteMs,
          standardTimeType,
        };
      }

      // 90分以下の場合
      case weeklyMaxStudyHour <= 90 * _minuteMs: {
        return {
          yAxisMax: 90 * _minuteMs,
          standardTimeType,
        };
      }

      // 3時間以下の場合
      case weeklyMaxStudyHour <= 3 * _hourMs: {
        return {yAxisMax: 3 * _hourMs, standardTimeType};
      }

      // 6時間以下の場合
      case weeklyMaxStudyHour <= 6 * _hourMs: {
        return {yAxisMax: 6 * _hourMs, standardTimeType};
      }

      // 12時間以下の場合
      case weeklyMaxStudyHour <= 12 * _hourMs: {
        return {yAxisMax: 12 * _hourMs, standardTimeType};
      }

      // 12時間より大きい場合
      default: {
        return {yAxisMax: _hourMs * 24, standardTimeType};
      }
    }
  }, [weeklyMaxStudyHour]);

  const ticks = useMemo(() => {
    return Array.from({length: numberYticks}).map((_, i) => {
      const maxTime = Math.floor(
        yAxisMax / (standardTimeType === '時間' ? _hourMs : _minuteMs),
      );
      const y = y0 + i * (yAxisLength / numberYticks);
      const yValue = Math.round(maxTime - i * (maxTime / numberYticks));
      const key = `tickKey_${i}`;
      return {y, yValue, key};
    });
  }, [yAxisMax, yAxisLength, y0, numberYticks, standardTimeType]);

  /*
  const ticks = useMemo(() => {
    return Array.from({length: numberYticks}).map((_, i) => {
      const minutes = 60;
      const y = y0 + i * (yAxisLength / numberYticks);
      const yValue = Math.round(minutes - i * (minutes / numberYticks));
      const key = `tickKey_${i}`;
      return (
        <G key={key}>
          <Line
            x1={x0}
            y1={y}
            x2={x0 + xAxisLength}
            y2={y}
            stroke="#ECECEC"
            strokeWidth="2"
          />
          <Text
            x={x0 - 5}
            y={y + 5}
            fill="#3F3F3F"
            fontSize="12"
            textAnchor="end"
          >
            {yValue}
          </Text>
        </G>
      );
    });
  }, [numberYticks, xAxisLength, yAxisLength, y0, x0]);
  */

  const barPlots = useMemo(() => {
    const barPlotWidth = xAxisLength / weeklyStudyHourList.length;
    const reversedWeeklyStudyHourList = [...weeklyStudyHourList].reverse();
    return reversedWeeklyStudyHourList.map(([day, dataY], i) => {
      const today = getTodayTimestamp();
      const dayTimeStamp = Timestamp.fromDate(day);
      const todayString = getMdString(today);
      const dayString = getMdString(dayTimeStamp);
      const displayDay =
        todayString === dayString ? '今日' : getMdString(dayTimeStamp);
      const x = x0 + i * barPlotWidth;
      const yRatio = dataY / yAxisMax;

      const y = y0 + (1 - yRatio) * yAxisLength;
      const height = yRatio * yAxisLength;
      const sidePadding = 20;
      const ukey = `data_analysis_bar_plot_${i}`;
      return {ukey, x, y, height, displayDay, sidePadding};
    });
  }, [yAxisMax, xAxisLength, yAxisLength, weeklyStudyHourList, x0, y0]);

  const barChartTicks = useMemo(() => {
    return ticks.map(({y, yValue, key}) => {
      return (
        <DataAnalysisBarChartTick
          key={key}
          ukey={key}
          x0={x0}
          y={y}
          xAxisLength={xAxisLength}
          yValue={yValue.toString()}
        />
      );
    });
  }, [ticks, x0, xAxisLength]);

  const textBars = useMemo(() => {
    return barPlots.map(({ukey, x, y, height, displayDay, sidePadding}) => {
      return (
        <DataAnalysisTextBar
          key={`roor_${ukey}`}
          ukey={ukey}
          width={xAxisLength / weeklyStudyHourList.length - sidePadding}
          height={height}
          x={x + sidePadding / 2}
          y={y}
          textY={xAxisY + 16}
          text={displayDay}
        />
      );
    });
  }, [barPlots, xAxisLength, weeklyStudyHourList.length, xAxisY]);

  return (
    <Svg width={svgWidth} height={svgHeight}>
      {/* X軸 */}
      <Line
        x1={x0}
        y1={xAxisY}
        x2={x0 + xAxisLength}
        y2={xAxisY}
        stroke="#ECECEC"
        strokeWidth="2"
      />

      {/* Y軸 */}
      <Line
        x1={x0}
        y1={y0}
        x2={x0}
        y2={y0 + yAxisLength}
        stroke="#ECECEC"
        strokeWidth="2"
      />
      <Text x={x0} y={y0 - 8} fill="#3F3F3F" fontSize="12" textAnchor="middle">
        {standardTimeType}
      </Text>

      {barChartTicks}
      {textBars}
    </Svg>
  );
};

export default DataAnalysisBarChart;

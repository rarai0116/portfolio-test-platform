import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import DataBar from '../../../parts/dataBar';
import Spacer from '../../../parts/spacer';

export type DataAnalysisCategoryDataBarProps = {
  readonly title?: string;
  readonly data: number[];
};

const DataAnalysisCategoryDataBar = (
  props: DataAnalysisCategoryDataBarProps,
) => {
  //  console.log('DataAnalysisCategoryDataBar rendered', props.title);
  const totalNumberOfQuestions: number = useMemo(() => {
    return props.data.reduce((sum, element) => {
      return sum + element;
    });
  }, [props.data]);

  // 小数点第二位以下切り捨て%
  const percentArray: number[] = useMemo(() => {
    return props.data.map((v, _i) => {
      return Math.floor((v / totalNumberOfQuestions) * 100 * 100) / 100;
    });
  }, [totalNumberOfQuestions, props.data]);
  // console.log(percentArray);

  // 小数点以下切り捨て%
  const truncatedPercentArray: number[] = useMemo(() => {
    return percentArray.map((_v, i) => {
      return Math.floor(percentArray[i]);
    });
  }, [percentArray]);
  // console.log(truncatedPercentArray);

  // 小数点以下
  const afterDecimalPointArray: number[] = useMemo(() => {
    return percentArray.map((_v, i) => {
      return (
        Math.floor(percentArray[i] * 100 - truncatedPercentArray[i] * 100) / 100 // 丸め誤差対応
      );
    });
  }, [percentArray, truncatedPercentArray]);
  // console.log(afterDecimalPointArray);

  const percentData: Array<{
    id: number;
    percent: number;
    truncatedPercent: number;
    afterDecimalPoint: number;
  }> = useMemo(() => {
    return percentArray.map((_v, i) => {
      return {
        id: i,
        percent: percentArray[i],
        truncatedPercent: truncatedPercentArray[i],
        afterDecimalPoint: afterDecimalPointArray[i],
      };
    });
  }, [percentArray, truncatedPercentArray, afterDecimalPointArray]);
  // console.log(percentData);

  /*
  const sortedPercentData = useMemo(() => {
    return percentData.sort(
      (a, b) => b.afterDecimalPoint - a.afterDecimalPoint,
    );
  }, [percentData]);
  */
  // console.log(sortedPercentData);

  // 小数点以下切り捨て%の合計
  const _totalPercent: number = useMemo(() => {
    return truncatedPercentArray.reduce((sum, element) => {
      return sum + element;
    });
  }, [truncatedPercentArray]);
  // console.log(totalPercent);

  /*
  const gap = useMemo(() => {
    return 100 - totalPercent;
  }, [totalPercent]);
  */
  /*
  const recalculateTruncatedPercent = useCallback(() => {
    let remain = gap;
    // console.log(gap);
    if (gap !== 0) {
      for (let i = 0; i < gap; i++) {
        if (remain === 0) {
          return;
        }

        sortedPercentData[i].truncatedPercent += 1;
        remain -= 1;
        // console.log(remain);
      }
    }
  }, [gap, sortedPercentData]);
  recalculateTruncatedPercent();
  */
  // console.log(sortedPercentData);

  const reSortedPercentData = useMemo(() => {
    return percentData.sort((a, b) => a.id - b.id);
  }, [percentData]);
  // console.log(reSortedPercentData);

  const recalculatedTruncatedPercentArray = useMemo(() => {
    return reSortedPercentData.map((_v, i) => {
      return reSortedPercentData[i].truncatedPercent;
    });
  }, [reSortedPercentData]);
  // console.log(recalculatedTruncatedPercentArray);

  return (
    <View style={tw`flex-row items-center`}>
      {props.title && (
        <View style={tw`min-w-6`}>
          <AppText style={tw`text-primary text-xs`}>{props.title}</AppText>
        </View>
      )}
      <Spacer isHorizontal size={16} />
      <DataBar
        percentArray={recalculatedTruncatedPercentArray}
        label={props.data}
        bgColor={['workbookblue-400', 'cautionyellow-300', 'quaternary']}
        textStyle={[
          [`text-xxs text-white leading-none py-0.5`],
          ['text-xxs text-primary leading-none py-0.5'],
          [`text-xxs text-primary leading-none py-0.5`],
        ]}
        barHeight={12}
        barRatio={7 / 12}
      />
      <View style={tw`min-w-8 items-end`}>
        <AppText
          style={tw`text-primary text-xs`}
        >{`${recalculatedTruncatedPercentArray[0]}%`}</AppText>
      </View>
    </View>
  );
};

export default DataAnalysisCategoryDataBar;

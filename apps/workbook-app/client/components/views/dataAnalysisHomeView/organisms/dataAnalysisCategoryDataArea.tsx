import {View} from 'react-native';
import React, {useContext, useMemo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import type {DataAnalysisCategoryDataType} from '../hooks/useDataAnalysisModeContext';
import {DataAnalysisContext} from '../hooks/useDataAnalysisModeContext';
import Spacer from '../../../parts/spacer';
import DataBar from '../../../parts/dataBar';
import {CheckButtonContext} from '../../../hooks/useCheckButtonContext';
import DataAnalysisCategoryDataList, {
  type DataAnalysisCategoryDataListProps,
} from '../parts/dataAnalysisCategoryDataList';
import {questionSubject} from '@/types/commonUnionType';

const MemoizedDataAnalysisCategoryDataList = React.memo(
  DataAnalysisCategoryDataList,
);

type DataAnalysisCategoryDataAreaProps = {} & Pick<
  DataAnalysisCategoryDataListProps,
  'onPressPlay'
>;

const DataAnalysisCategoryDataArea = (
  props: DataAnalysisCategoryDataAreaProps,
) => {
  const {categoryDataSet} = useContext(DataAnalysisContext);
  const {checkedButtonList} = useContext(CheckButtonContext);

  const {subOne, subTwo, subThree, subFour, subFive} = useMemo(() => {
    const data = categoryDataSet.reduce(
      (acc, v) => {
        if (v.id.includes(questionSubject.subjectOne)) {
          acc.subOne.push(v);
        } else if (v.id.includes(questionSubject.subjectTwo)) {
          acc.subTwo.push(v);
        } else if (v.id.includes(questionSubject.subjectThree)) {
          acc.subThree.push(v);
        } else if (v.id.includes(questionSubject.subjectFour)) {
          acc.subFour.push(v);
        } else if (v.id.includes(questionSubject.subjectFive)) {
          acc.subFive.push(v);
        }

        return acc;
      },
      {
        subOne: [] as DataAnalysisCategoryDataType[],
        subTwo: [] as DataAnalysisCategoryDataType[],
        subThree: [] as DataAnalysisCategoryDataType[],
        subFour: [] as DataAnalysisCategoryDataType[],
        subFive: [] as DataAnalysisCategoryDataType[],
      },
    );
    return {
      subOne: (
        <MemoizedDataAnalysisCategoryDataList
          data={data.subOne}
          onPressPlay={props.onPressPlay}
        />
      ),
      subTwo: (
        <MemoizedDataAnalysisCategoryDataList
          data={data.subTwo}
          onPressPlay={props.onPressPlay}
        />
      ),
      subThree: (
        <MemoizedDataAnalysisCategoryDataList
          data={data.subThree}
          onPressPlay={props.onPressPlay}
        />
      ),
      subFour: (
        <MemoizedDataAnalysisCategoryDataList
          data={data.subFour}
          onPressPlay={props.onPressPlay}
        />
      ),
      subFive: (
        <MemoizedDataAnalysisCategoryDataList
          data={data.subFive}
          onPressPlay={props.onPressPlay}
        />
      ),
    };
  }, [categoryDataSet, props.onPressPlay]);

  return (
    <View>
      <View style={tw`items-center pr-6`}>
        <Spacer isHorizontal={false} size={4} />
        <View style={tw`flex-row pl-14 items-end`}>
          <View>
            <DataBar
              percentArray={[33, 34, 33]}
              label={['正解', '苦手', '未回答']}
              textStyle={[
                ['text-primary text-xs'],
                ['text-primary text-xs'],
                ['text-primary text-xs'],
              ]}
              bgColor={['background', 'background', 'background']}
              barHeight={16}
              barRatio={7 / 12}
            />

            <DataBar
              percentArray={[33, 34, 33]}
              bgColor={['workbookblue-400', 'cautionyellow-300', 'quaternary']}
              barHeight={12}
              barRatio={7 / 12}
            />
          </View>

          <AppText style={tw`text-primary text-xs pl-4`}>正解率</AppText>
        </View>
      </View>
      <Spacer isHorizontal={false} size={16} />
      <View
        style={tw`${checkedButtonList[0].id === questionSubject.subjectOne ? '' : 'hidden'}`}
      >
        {subOne}
      </View>
      <View
        style={tw`${checkedButtonList[0].id === questionSubject.subjectTwo ? '' : 'hidden'}`}
      >
        {subTwo}
      </View>
      <View
        style={tw`${checkedButtonList[0].id === questionSubject.subjectThree ? '' : 'hidden'}`}
      >
        {subThree}
      </View>
      <View
        style={tw`${checkedButtonList[0].id === questionSubject.subjectFour ? '' : 'hidden'}`}
      >
        {subFour}
      </View>
      <View
        style={tw`${checkedButtonList[0].id === questionSubject.subjectFive ? '' : 'hidden'}`}
      >
        {subFive}
      </View>
      <Spacer isHorizontal={false} size={72} />
    </View>
  );
};

export default DataAnalysisCategoryDataArea;

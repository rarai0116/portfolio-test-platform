import {View} from 'react-native';
import {useMemo} from 'react';
import Spacer from '../../../parts/spacer';
import type {CategoryData} from '../hooks/useDataAnalysisModeContext/useDataAnalysisCategoryData';
import DataAnalysisCategoryData from './dataAnalysisCategoryData';

export type DataAnalysisCategoryDataListProps = {
  readonly data: CategoryData[];
  readonly onPressPlay: (
    isQandA: boolean,
    categoryData: CategoryData,
    currentSettingId: string,
  ) => void;
};

const DataAnalysisCategoryDataList = (
  props: DataAnalysisCategoryDataListProps,
) => {
  const dataListBody = useMemo(() => {
    //  console.log('DataAnalysisCategoryDataList dataListBody rendered');
    return props.data.map((v) => {
      const categoryDataType = (() => {
        if (v.id.split('-').length === 3) {
          return 'small';
        }

        if (v.id.split('-').length === 2) {
          return 'big';
        }

        return 'subject';
      })();
      const currentSettingId = categoryDataType.concat(`-${v.id}`);

      return (
        <View key={v.id}>
          <DataAnalysisCategoryData
            id={v.id}
            title={v.id}
            categoryData={v}
            categoryDataType={categoryDataType}
            onPressOutMultipleChoice={() => {
              props.onPressPlay(false, v, currentSettingId);
            }}
            onPressOutQandA={() => {
              props.onPressPlay(true, v, currentSettingId);
            }}
          />
          <Spacer isHorizontal={false} size={12} />
        </View>
      );
    });
  }, [props]);

  return <View>{dataListBody}</View>;
};

export default DataAnalysisCategoryDataList;

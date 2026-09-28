import {View} from 'react-native';
import {useCallback, useContext, useMemo, memo} from 'react';
import tw from '../../../../tailwind.custom';
import AppText from '../../../identities/appText';
import {questionGrade} from '../../../../types/commonUnionType';
import PlayIcon from '../../../../assets/svg/play_start-task-button-from-data-analytics.svg';
import BasisButton from '../../../identities/button';
import {ButtonContextProvider} from '../../../hooks/useButtonContext';
import {GlobalUserSettingContext} from '../../../hooks/useGlobalUserSettingContext';
import Spacer from '../../../parts/spacer';
import type {CategoryData} from '../hooks/useDataAnalysisModeContext/useDataAnalysisCategoryData';
import DataAnalysisCategoryDataBar from './dataAnalysisCategoryDataBar';

export type DataAnalysisCategoryDataProps = {
  readonly id: string;
  readonly title: string;
  readonly categoryDataType: 'subject' | 'big' | 'small';
  readonly onPressOutMultipleChoice: () => void;
  readonly onPressOutQandA: () => void;
  readonly categoryData: CategoryData;
};

const DataAnalysisCategoryData = memo(
  (props: DataAnalysisCategoryDataProps) => {
    //  console.log('DataAnalysisCategoryData rendered', props.id, props.title);
    const {grade} = useContext(GlobalUserSettingContext);
    const {title, bgColor, border} = useMemo(() => {
      switch (props.categoryDataType) {
        case 'subject': {
          return {
            bgColor: 'bg-workbookblue-50',
            title: props.title.replaceAll(/(.+)-(.+)/g, '$2'),
            border: '',
          };
        }

        case 'big': {
          return {
            bgColor: 'bg-quaternary',
            title: props.title.replaceAll(/(.+)-(.+)-(.+)/g, '$3'),
            border: '',
          };
        }

        case 'small': {
          return {
            bgColor: 'bg-white',
            title: props.title.replaceAll(/(.+)-(.+)-(.+)-(.+)/g, '$4'),
            border: 'border-b border-solid border-quaternary',
          };
        }
      }
    }, [props.title, props.categoryDataType]);

    const multipleChoiceData = useMemo(() => {
      return [
        props.categoryData.multipleChoice.correctlyAndNoWeakly,
        props.categoryData.multipleChoice.weakly,
        props.categoryData.multipleChoice.noAnswered,
      ];
    }, [props.categoryData.multipleChoice]);

    const qandaData = useMemo(() => {
      return [
        props.categoryData.qAndA.correctlyAndNoWeakly,
        props.categoryData.qAndA.weakly,
        props.categoryData.qAndA.noAnswered,
      ];
    }, [props.categoryData.qAndA]);

    const isEnabled = useCallback((data: number[]) => {
      return data.every((v) => v >= 0);
    }, []);
    const isMultipleChoiceEnabled = useMemo(
      () => isEnabled(multipleChoiceData),
      [isEnabled, multipleChoiceData],
    );
    const isQaaEnabled = useMemo(
      () => isEnabled(qandaData),
      [isEnabled, qandaData],
    );

    return (
      <View key={`dacd-${props.id}`} style={tw`items-center`}>
        <View
          style={tw`w-11/12 h-9 rounded-t-md ${bgColor} ${border} px-4 py-1.5`}
        >
          <View style={tw`flex-row justify-between`}>
            <AppText style={tw`text-primary text-base`} numberOfLines={1}>
              {title}
            </AppText>
          </View>
        </View>

        <View style={tw`w-11/12 items-center rounded-b-md bg-white py-2.5`}>
          {isMultipleChoiceEnabled && (
            <View style={tw`flex-row`}>
              <DataAnalysisCategoryDataBar
                title={grade === questionGrade.gradeOne ? '四択' : '五択'}
                data={multipleChoiceData}
              />
              <Spacer isHorizontal size={4} />
              <ButtonContextProvider
                onPressOut={props.onPressOutMultipleChoice}
              >
                <BasisButton width="24px" height="24px" pressedOpacity={0.7}>
                  <PlayIcon width={24} height={24} />
                </BasisButton>
              </ButtonContextProvider>
            </View>
          )}

          {isQaaEnabled && (
            <>
              <Spacer isHorizontal={false} size={8} />
              <View style={tw`flex-row`}>
                <DataAnalysisCategoryDataBar title="〇✕" data={qandaData} />
                <Spacer isHorizontal size={4} />
                <ButtonContextProvider onPressOut={props.onPressOutQandA}>
                  <BasisButton width="24px" height="24px" pressedOpacity={0.7}>
                    <PlayIcon width={24} height={24} />
                  </BasisButton>
                </ButtonContextProvider>
              </View>
            </>
          )}
        </View>
      </View>
    );
  },
);

export default DataAnalysisCategoryData;

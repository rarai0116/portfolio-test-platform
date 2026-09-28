import {View, ScrollView} from 'react-native';
import {useEffect, useMemo, useContext} from 'react';
import tw from '../../../tailwind.custom';
import AppText from '../../identities/appText';
import type {ButtonInfoList} from '../../hooks/useCheckButtonContext';
import {
  CheckButtonStates,
  useCheckedButtonList,
  CheckButtonContextProvider,
} from '../../hooks/useCheckButtonContext';
import SecondaryTabs from '../../parts/secondaryTabs';
import Spacer from '../../parts/spacer';
import {questionGrade} from '../../../types/commonUnionType';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import {DataAnalysisContext} from './hooks/useDataAnalysisModeContext';
import DataAnalysisRadarChart from './parts/dataAnalysisRadarChart';
import DataAnalysisPieChartCard from './organisms/dataAnalysisPieChartCard';

export type DataAnalysisHomeSecondaryTabsProps = {readonly index: number};

const dataKey = (isQaa: boolean) => (isQaa ? 'qAndA' : 'multipleChoice');

const DataAnalysisHomeSecondaryTabsView = (
  props: DataAnalysisHomeSecondaryTabsProps,
) => {
  const {dataAnalysisHomeData, setIsQaa, isQaa} =
    useContext(DataAnalysisContext);
  // const {grade} = useContext(QuestionModeContext);
  const {grade} = useContext(GlobalUserSettingContext);

  //  const [key, setKey] = useState<'multipleChoice' | 'qAndA'>('multipleChoice');

  const secondTabButtonInfoList: ButtonInfoList = useMemo(() => {
    return [
      grade === questionGrade.gradeOne
        ? {
            id: '四択',
            name: '四択',
            initialState: CheckButtonStates.checked,
          }
        : {
            id: '五択',
            name: '五択',
            initialState: CheckButtonStates.checked,
          },
      {
        id: '〇✕',
        name: '〇✕',
        initialState: CheckButtonStates.unchecked,
      },
    ];
  }, [grade]);

  const [secondTabCheckedButtonInfoList, setSecondTabCheckedButtonInfoList] =
    useCheckedButtonList(secondTabButtonInfoList);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // SecondaryTabsを初期化
    setSecondTabCheckedButtonInfoList([
      grade === questionGrade.gradeOne
        ? {
            id: '四択',
            name: '四択',
            initialState: CheckButtonStates.checked,
          }
        : {
            id: '五択',
            name: '五択',
            initialState: CheckButtonStates.checked,
          },
    ]);
  }, [props.index, grade, setSecondTabCheckedButtonInfoList]);

  return (
    <CheckButtonContextProvider
      buttonInfoList={secondTabButtonInfoList}
      checkedButtonList={secondTabCheckedButtonInfoList}
      setCheckedButtonList={setSecondTabCheckedButtonInfoList}
    >
      <View>
        <SecondaryTabs
          onActivateFunctionList={[
            () => {
              setIsQaa(false);
            },
            () => {
              setIsQaa(true);
            },
          ]}
        />
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={tw`grow`}
          style={tw`w-full `}
        >
          <View style={tw`items-center`}>
            <Spacer isHorizontal={false} size={12} />
            <View
              style={tw`items-center w-11/12 bg-white rounded-md px-6 py-3`}
            >
              <AppText
                style={tw`text-primary text-base`}
              >{`今まで解いた問題数  ${dataAnalysisHomeData[dataKey(isQaa)].totalSolvedQuestions}問`}</AppText>
            </View>
            <Spacer isHorizontal={false} size={12} />

            <DataAnalysisPieChartCard
              data={dataAnalysisHomeData[dataKey(isQaa)].pieChartData}
            />

            <Spacer isHorizontal={false} size={12} />
            <View
              style={tw`w-11/12 items-center justify-center bg-white rounded-md flex-row py-3`}
            >
              <DataAnalysisRadarChart />
            </View>
          </View>
          <Spacer isHorizontal={false} size={200} />
        </ScrollView>
      </View>
    </CheckButtonContextProvider>
  );
};

export default DataAnalysisHomeSecondaryTabsView;

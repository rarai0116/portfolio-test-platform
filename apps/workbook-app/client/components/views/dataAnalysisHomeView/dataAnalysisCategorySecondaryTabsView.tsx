import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useCallback, useEffect, useMemo, useContext} from 'react';
import tw from '../../../tailwind.custom';
import type {ButtonInfoList} from '../../hooks/useCheckButtonContext';
import {
  CheckButtonStates,
  useCheckedButtonList,
  CheckButtonContextProvider,
} from '../../hooks/useCheckButtonContext';
import SecondaryTabs from '../../parts/secondaryTabs';
import Background from '../../parts/background';
import Spacer from '../../parts/spacer';
import {questionGrade} from '../../../types/commonUnionType';
import {
  dataAnalysisModalStates,
  questionSettingState,
} from '../../../types/commonUnionType';
import {ModalManagerContext} from '../../hooks/useModalManagerContext';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import {DataAnalysisContext} from './hooks/useDataAnalysisModeContext';
import DataAnalysisCategoryDataArea from './organisms/dataAnalysisCategoryDataArea';
import type {CategoryData} from './hooks/useDataAnalysisModeContext/useDataAnalysisCategoryData';

export type DataAnalysisCategorySecondaryTabsProps = {readonly index: number};

const DataAnalysisCategorySecondaryTabsView = (
  props: DataAnalysisCategorySecondaryTabsProps,
) => {
  //  console.log('DataAnalysisCategorySecondaryTabsView rendered', props.index);
  const {grade} = useContext(DataAnalysisContext);

  const {showModal} = useContext(ModalManagerContext);
  const {currentPlayData} = useContext(GlobalUserSettingContext);
  /*  const {setDataAnalysisQuestionSettingState} = useContext(
    QuestionSettingViewContext,
  );
*/
  const {setSelectedTask, settingIdToCardData} =
    useContext(DataAnalysisContext);

  const hasInterruptedData = useMemo(() => {
    if (currentPlayData === null) return false;
    return (
      !currentPlayData.isFinished &&
      currentPlayData.settingCardData.settingState !== questionSettingState.task
    );
  }, [currentPlayData]);

  const onPressPlay = useCallback(
    (isQaA: boolean, categoryData: CategoryData, currentSettingId: string) => {
      // ここにcategoryDataまたはcurrentSettingIdからSettingCardDataを作成するロジックを追加
      const card = settingIdToCardData(
        isQaA ? categoryData.qAndA : categoryData.multipleChoice,
        currentSettingId,
        isQaA,
      );
      setSelectedTask(card);

      //      setCurrentSettingId(currentSettingId);
      /*
      setDataAnalysisQuestionSettingState({
        categoryDataCell: isQaA
          ? categoryData.qAndA
          : categoryData.multipleChoice,
        questionFormat: isQaA
          ? initialPracticeQuestionSetting.questionFormat[1].id
          : initialPracticeQuestionSetting.questionFormat[0].id,
      });
      */
      if (hasInterruptedData) {
        showModal(dataAnalysisModalStates.interruptedDataModal);
      } else {
        showModal(dataAnalysisModalStates.viewModal);
      }
    },
    [hasInterruptedData, showModal, settingIdToCardData, setSelectedTask],
  );

  const secondTabButtonInfoList: ButtonInfoList = useMemo(() => {
    const list = [
      {
        id: '学科Ⅰ',
        name: '学科Ⅰ',
        initialState: CheckButtonStates.checked,
      },
      {
        id: '学科Ⅱ',
        name: '学科Ⅱ',
        initialState: CheckButtonStates.unchecked,
      },
      {
        id: '学科Ⅲ',
        name: '学科Ⅲ',
        initialState: CheckButtonStates.unchecked,
      },
      {
        id: '学科Ⅳ',
        name: '学科Ⅳ',
        initialState: CheckButtonStates.unchecked,
      },
    ];

    if (grade === questionGrade.gradeOne) {
      return list.concat({
        id: '学科Ⅴ',
        name: '学科Ⅴ',
        initialState: CheckButtonStates.unchecked,
      });
    }

    return list;
  }, [grade]);

  const [secondTabCheckedButtonInfoList, setSecondTabCheckedButtonInfoList] =
    useCheckedButtonList(secondTabButtonInfoList);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    // SecondaryTabsを初期化
    setSecondTabCheckedButtonInfoList((prev) => [
      ...prev,
      {
        id: '学科Ⅰ',
        name: '学科Ⅰ',
        initialState: CheckButtonStates.checked,
      },
    ]);
  }, [props.index]);

  return (
    <CheckButtonContextProvider
      buttonInfoList={secondTabButtonInfoList}
      checkedButtonList={secondTabCheckedButtonInfoList}
      setCheckedButtonList={setSecondTabCheckedButtonInfoList}
    >
      <Background>
        <View>
          <SecondaryTabs />
          <ScrollView
            nestedScrollEnabled
            contentContainerStyle={tw`grow`}
            style={tw`w-full `}
          >
            <DataAnalysisCategoryDataArea onPressPlay={onPressPlay} />
            <Spacer isHorizontal={false} size={300} />
          </ScrollView>
        </View>
      </Background>
    </CheckButtonContextProvider>
  );
};

export default DataAnalysisCategorySecondaryTabsView;

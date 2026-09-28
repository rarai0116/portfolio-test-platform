import {useEffect, useContext} from 'react';
import {useRoute, CommonActions} from '@react-navigation/native';
import {useIsFocused} from '@react-navigation/native';
import {useNavigation} from '@react-navigation/native';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import {
  type DataAnalysisViewsProps,
  allScreenIdList,
} from '../../../types/viewParameter';
import ModalManagerContextProvider from '../../hooks/useModalManagerContext';
import DataAnalysisContextProvider from './hooks/useDataAnalysisModeContext';
import ContainerView from './containerView';
import type {DataAnalysisHomeViewProps} from './containerView';
import Background from '@/components/parts/background';

const DataAnalysisHomeView = (_props: DataAnalysisHomeViewProps) => {
  const isFocused = useIsFocused();
  const _route =
    useRoute<DataAnalysisViewsProps<'DataAnalysisHome'>['route']>();
  const navigation =
    useNavigation<DataAnalysisViewsProps<'DataAnalysisHome'>['navigation']>();
  const {readyForTest, setIsDisabledInput} = useContext(
    GlobalUserSettingContext,
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    console.log('テスト開始チェック', readyForTest);
    if (!readyForTest.isComplete) return;
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'Test',
            params: {
              userId: allScreenIdList.Test,
              screen: 'QuestionAndChoicesView',
              params: {
                userId: allScreenIdList.QuestionAndChoicesView,
              },
            },
          },
        ],
      }),
    );
    setIsDisabledInput(false);
  }, [readyForTest.isComplete]);

  return (
    <DataAnalysisContextProvider>
      <ModalManagerContextProvider>
        <Background>
          <ContainerView />
        </Background>
      </ModalManagerContextProvider>
    </DataAnalysisContextProvider>
  );
};

export default DataAnalysisHomeView;

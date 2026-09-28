import {useWindowDimensions} from 'react-native';
import React, {useContext} from 'react';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import FailedStartTestModals from '@organisms/failedStartTestModal';
import {dataAnalysisModalStates} from '../../../types/commonUnionType';
import {QuestionSettingViewContext} from '../../hooks/useQuestionSettingViewContext';
import DataAnalysisStudyHoursView from './dataAnalysisStudyHoursView';
import DataAnalysisHomeSecondaryTabsView from './dataAnalysisHomeSecondaryTabsView';
import DataAnalysisCategorySecondaryTabsView from './dataAnalysisCategorySecondaryTabsView';
import TaskPreviewModal from './organisms/taskPreviewModal';
import InterruptedDataModal from './organisms/InterruptedDataModal';
import {DataAnalysisContext} from './hooks/useDataAnalysisModeContext';

export type DataAnalysisHomeViewProps = Record<string, never>;

const Tab = createMaterialTopTabNavigator();
const MemorizedDataAnalysisCategorySecondaryTabsView = React.memo(
  DataAnalysisCategorySecondaryTabsView,
);
const MemorizedDataAnalysisHomeSecondaryTabsView = React.memo(
  DataAnalysisHomeSecondaryTabsView,
);
const OneTab = () => {
  return <MemorizedDataAnalysisHomeSecondaryTabsView index={0} />;
};

const TwoTab = () => {
  return <MemorizedDataAnalysisCategorySecondaryTabsView index={2} />;
};

const ContainerView = (_props: DataAnalysisHomeViewProps) => {
  const layout = useWindowDimensions();

  const {selectedTask} = useContext(DataAnalysisContext);
  const {startPracticeTest} = useContext(QuestionSettingViewContext);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarIndicatorStyle: {backgroundColor: '#289DF4', height: 1},
          tabBarStyle: {backgroundColor: 'white'},
          tabBarLabelStyle: {fontSize: 16},
          tabBarInactiveTintColor: '#3F3F3F',
          tabBarActiveTintColor: '#289DF4',
          tabBarPressColor: 'transparent',
          tabBarScrollEnabled: false,
          animationEnabled: false,
        }}
        initialLayout={{width: layout.width}}
        initialRouteName="総合成績"
        tabBarPosition="top"
      >
        <Tab.Screen name="総合成績" component={OneTab} />
        <Tab.Screen name="学習時間" component={DataAnalysisStudyHoursView} />
        <Tab.Screen name="カテゴリ成績" component={TwoTab} />
      </Tab.Navigator>
      <FailedStartTestModals
        notEnoughQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
          onPressOutCancelButton() {},
        }}
        noQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
        }}
        questionStartFailedModalProps={{
          onPressOutCloseButton() {},
        }}
      />
      {/* <QuestionSettingViewModal id={dataAnalysisModalStates.viewModal} /> */}
      <TaskPreviewModal
        id={dataAnalysisModalStates.viewModal}
        selectedTaskData={selectedTask}
        onPressOut={() => {
          if (!selectedTask) return;
          startPracticeTest(selectedTask.id, selectedTask).catch(
            (error: unknown) => {
              console.error('Error starting practice test:', error);
            },
          );
        }}
      />
      <InterruptedDataModal id={dataAnalysisModalStates.interruptedDataModal} />
    </>
  );
};

export default ContainerView;

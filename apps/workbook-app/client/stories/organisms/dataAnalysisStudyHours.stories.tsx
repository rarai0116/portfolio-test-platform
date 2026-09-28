import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisStudyHours from "../../components/views/dataAnalysisHomeView/dataAnalysisStudyHoursView";
import DataAnalysisContextProvider from "../../components/views/dataAnalysisHomeView/hooks/useDataAnalysisModeContext";

type T = typeof DataAnalysisStudyHours;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/DataAnalysisStudyHours",
  component: DataAnalysisStudyHours,
  args: {},
};

const Template: Story = (args) => (
  <DataAnalysisContextProvider>
    <DataAnalysisStudyHours {...args} />
  </DataAnalysisContextProvider>
);

export const basic = {
  render: Template,

  args: {
    consecutiveStudyDays: 7,
    todaysStudyHours: 600_000,
    totalStudyDays: 25,
    totalStudyHours: 100_000_000,
  },
};

export default meta;

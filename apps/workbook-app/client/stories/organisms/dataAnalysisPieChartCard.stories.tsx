import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisPieChartCard from "../../components/views/dataAnalysisHomeView/organisms/dataAnalysisPieChartCard";
import DataAnalysisContextProvider from "../../components/views/dataAnalysisHomeView/hooks/useDataAnalysisModeContext";

type T = typeof DataAnalysisPieChartCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/DataAnalysisPieChartCard",
  component: DataAnalysisPieChartCard,
  args: {},
};

const pieChartData = [
  {
    name: "正解",
    numberOfQuestions: 600,
  },
  {
    name: "苦手",
    numberOfQuestions: 100,
  },
  {
    name: "未回答",
    numberOfQuestions: 300,
  },
];

const Template: Story = (args) => (
  <DataAnalysisContextProvider>
    <DataAnalysisPieChartCard {...args} />
  </DataAnalysisContextProvider>
);

export const basic = {
  render: Template,

  args: {
    data: pieChartData,
  },
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisPieChart from "../../components/views/dataAnalysisHomeView/parts/dataAnalysisPieChart";

type T = typeof DataAnalysisPieChart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataAnalysisPieChart",
  component: DataAnalysisPieChart,
  args: {},
};

export const basic = {
  args: {
    numberOfQuestions: [600, 100, 300],
  },
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

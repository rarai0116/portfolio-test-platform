import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisBarChart from "../../components/views/dataAnalysisHomeView/parts/dataAnalysisBarChart";

type T = typeof DataAnalysisBarChart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataAnalysisBarChart",
  component: DataAnalysisBarChart,
  args: {},
};

export const basic = {
  args: {},
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

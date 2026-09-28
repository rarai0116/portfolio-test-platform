import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisRadarChart from "../../components/views/dataAnalysisHomeView/parts/dataAnalysisRadarChart";

type T = typeof DataAnalysisRadarChart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataAnalysisRadarChart",
  component: DataAnalysisRadarChart,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisCategoryDataBar from "../../components/views/dataAnalysisHomeView/parts/dataAnalysisCategoryDataBar";

type T = typeof DataAnalysisCategoryDataBar;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataAnalysisCategoryDataBar",
  component: DataAnalysisCategoryDataBar,
  args: {},
};

export const basic = {
  args: {
    title: "四択",
    data: [120, 20, 10],
  },
};

export default meta;

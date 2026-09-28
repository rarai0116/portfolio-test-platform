import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisCategoryData from "../../components/views/dataAnalysisHomeView/parts/dataAnalysisCategoryData";
import { questionCategoryName } from "../../types/commonUnionType";

type T = typeof DataAnalysisCategoryData;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataAnalysisCategoryData",
  component: DataAnalysisCategoryData,
  args: {},
};

export const basic = {
  args: {
    id: "small-学科Ⅲ-建築基準法-用語の定義",
    title: "用語の定義",
    onPressOut() {
      console.info("press");
    },
    categoryData: {
      id: "small-学科Ⅲ-建築基準法-用語の定義",
      title: "用語の定義",
      multipleChoice: {
        correctlyAndNoWeakly: 100,
        weakly: 20,
        noAnswered: 10,
      },
      qAndA: {
        correctlyAndNoWeakly: 10,
        weakly: 20,
        noAnswered: 20,
      },
    },
  },
};

export default meta;

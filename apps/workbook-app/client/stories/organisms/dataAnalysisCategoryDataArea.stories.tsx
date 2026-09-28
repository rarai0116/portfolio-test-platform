import { Meta, StoryObj, StoryFn } from "@storybook/react";
import { useEffect } from "react";
import DataAnalysisContextProvider from "../../components/views/dataAnalysisHomeView/hooks/useDataAnalysisModeContext";
import DataAnalysisCategoryDataArea from "../../components/views/dataAnalysisHomeView/organisms/dataAnalysisCategoryDataArea";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";

type T = typeof DataAnalysisCategoryDataArea;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/DataAnalysisCategoryDataList",
  component: DataAnalysisCategoryDataArea,
  args: {},
};

const Template: Story = (args) => {
  const buttonInfoList = [
    { id: "学科Ⅱ", name: "学科Ⅱ", initialState: CheckButtonStates.checked },
  ];
  const [secondTabCheckedButtonInfoList, setSecondTabCheckedButtonInfoList] =
    useCheckedButtonList(buttonInfoList);
  useEffect(() => {
    setSecondTabCheckedButtonInfoList(buttonInfoList);
  });
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={buttonInfoList}
      setCheckedButtonList={setSecondTabCheckedButtonInfoList}
    >
      <DataAnalysisContextProvider>
        <DataAnalysisCategoryDataArea {...args} />
      </DataAnalysisContextProvider>
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    subject: "学科Ⅰ",
  },
};

export default meta;

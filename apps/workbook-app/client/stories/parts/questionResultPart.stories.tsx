import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionResultPart, {
  resultState,
} from "../../components/parts/questionResultPart";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";
import {
  CheckButtonStates,
  CheckButtonContextProvider,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";

type T = typeof QuestionResultPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/QuestionResultPart",
  component: QuestionResultPart,
  args: {},
};

const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "No.11",
    initialState: CheckButtonStates.unchecked,
  },
];

const Template: Story = (args) => {
  const [checkedButtonList, setCheckedButtonList] =
    useCheckedButtonList(buttonInfoList);
  return (
    <CheckButtonContextProvider
      buttonInfoList={buttonInfoList}
      checkedButtonList={checkedButtonList}
      setCheckedButtonList={setCheckedButtonList}
    >
      <QuestionResultPart {...args} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    buttonInfo: buttonInfoList[0],
    result: resultState.correct,
    onPressOut() {
      console.info("onPressOut");
    },
  },
};

export default meta;

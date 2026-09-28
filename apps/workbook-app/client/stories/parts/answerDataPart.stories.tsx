import { Meta, StoryObj, StoryFn } from "@storybook/react";
import AnswerDataPart from "../../components/parts/answerDataPart";
import type { ButtonInfoList } from "../../components/hooks/useCheckButtonContext";
import {
  CheckButtonContextProvider,
  CheckButtonStates,
  useCheckedButtonList,
} from "../../components/hooks/useCheckButtonContext";

type T = typeof AnswerDataPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/AnswerDataPart",
  component: AnswerDataPart,
  args: {},
};

const buttonInfoList: ButtonInfoList = [
  {
    id: "0",
    name: "",
    initialState: CheckButtonStates.disabled,
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
      <AnswerDataPart {...args} />
    </CheckButtonContextProvider>
  );
};

export const basic = {
  render: Template,

  args: {
    correctAnswer: "1",
    usersAnswer: "3",
    isCorrect: false,
    buttonInfo: buttonInfoList[0],
  },
};

export default meta;

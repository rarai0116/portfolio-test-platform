import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ChoiceButton from "../../components/parts/choiceButton";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";
import CircleIcon from "../../assets/svg/circle_right-answer_small_blue.svg";
import { questionFormat } from "../../types/commonUnionType";

type T = typeof ChoiceButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ChoiceButton",
  component: ChoiceButton,
  argTypes: {
    type: {
      options: ["number", "qa"],
      control: { type: "radio" },
    },
  },
};

const Template: Story = (args) => (
  <ButtonContextProvider
    onPressOut={() => {
      console.info("onPressOut");
    }}
  >
    <ChoiceButton {...args} />
  </ButtonContextProvider>
);

export const NumberChoiceButton = {
  render: Template,

  args: {
    type: questionFormat.fourChoices,
    number: "1",
  },
};

export const QandaChoiceButton = {
  render: Template,

  args: {
    type: questionFormat.qAndA,
    children: <CircleIcon width={16} height={16} />,
  },
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SmallButton from "../../components/parts/smallButton";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";

type T = typeof SmallButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/SmallButton",
  component: SmallButton,
  argTypes: {
    text: {
      options: ["不備を報告", "解説"],
      control: { type: "radio" },
    },
    width: {
      options: ["90px", "48px"],
      control: { type: "radio" },
    },
  },
};

const Template: Story = (args) => (
  <ButtonContextProvider
    onPressOut={() => {
      console.info("押した");
    }}
  >
    <SmallButton {...args} />
  </ButtonContextProvider>
);

export const ReportError = {
  render: Template,

  args: {
    text: "不備を報告",
    width: "90px",
  },
};

export const Explanation = {
  render: Template,

  args: {
    text: "解説",
    width: "48px",
  },
};

export default meta;

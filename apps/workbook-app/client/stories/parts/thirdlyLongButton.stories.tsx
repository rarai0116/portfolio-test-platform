import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ThirdlyLongButton from "../../components/parts/thirdlyLongButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof ThirdlyLongButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/ThirdlyLongButton",
  component: ThirdlyLongButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.disabled}>
    <ThirdlyLongButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Long",
  },
};

export default meta;

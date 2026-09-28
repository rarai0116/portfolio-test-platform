import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SecondaryLongButton from "../../components/parts/secondaryLongButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof SecondaryLongButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/SecondaryLongButton",
  component: SecondaryLongButton,
  args: {},
};
const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <SecondaryLongButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Long",
  },
};

export default meta;

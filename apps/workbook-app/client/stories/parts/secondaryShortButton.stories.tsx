import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SecondaryShortButton from "../../components/parts/secondaryShortButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof SecondaryShortButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/SecondaryShortButton",
  component: SecondaryShortButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <SecondaryShortButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Short",
  },
};

export default meta;

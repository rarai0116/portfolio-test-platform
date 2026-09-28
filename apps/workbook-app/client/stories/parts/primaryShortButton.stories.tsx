import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PrimaryShortButton from "../../components/parts/primaryShortButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof PrimaryShortButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/PrimaryShortButton",
  component: PrimaryShortButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <PrimaryShortButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Short",
  },
};

export default meta;

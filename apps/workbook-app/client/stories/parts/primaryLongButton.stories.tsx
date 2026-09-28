import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PrimaryLongButton from "../../components/parts/primaryLongButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof PrimaryLongButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/PrimaryLongButton",
  component: PrimaryLongButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <PrimaryLongButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Long",
  },
};

export default meta;

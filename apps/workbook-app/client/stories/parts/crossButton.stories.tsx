import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CrossButton from "../../components/parts/crossButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof CrossButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/CrossButton",
  component: CrossButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <CrossButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    color: "#289DF4",
    crossSize: "60px",
  },
};

export default meta;

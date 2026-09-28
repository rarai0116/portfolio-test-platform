import { Meta, StoryObj, StoryFn } from "@storybook/react";
import TaskButton from "../../components/parts/taskButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof TaskButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/TaskButton",
  component: TaskButton,
  argTypes: {
    type: {
      options: ["add", "save", "start"],
      control: { type: "radio" },
    },
  },
};
const Template: Story = (args) => (
  <ButtonContextProvider
    state={ButtonStates.released}
    onPressOut={() => {
      console.info("押した");
    }}
  >
    <TaskButton {...args} />
  </ButtonContextProvider>
);

export const Add = {
  render: Template,

  args: {
    type: "add",
  },
};

export const Save = {
  render: Template,

  args: {
    type: "save",
  },
};

export const Start = {
  render: Template,

  args: {
    type: "start",
  },
};

export default meta;

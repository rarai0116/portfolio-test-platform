import { Meta, StoryObj, StoryFn } from "@storybook/react";
import TaskStateBadge from "../../components/parts/taskStateBadge";

type T = typeof TaskStateBadge;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/TaskStateBadge",
  component: TaskStateBadge,
  argTypes: {
    state: {
      options: ["途中", "完了"],
      control: { type: "radio" },
    },
  },
};

export const Progress = {
  args: {
    state: "途中",
  },
};

export const Complete = {
  args: {
    state: "完了",
  },
};

export default meta;

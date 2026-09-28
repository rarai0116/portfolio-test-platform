import { Meta, StoryObj, StoryFn } from "@storybook/react";
import Background from "../../components/parts/background";

type T = typeof Background;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Background",
  component: Background,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

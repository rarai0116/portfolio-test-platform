import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ProgressTracker from "../../components/parts/progressTracker";

type T = typeof ProgressTracker;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ProgressTracker",
  component: ProgressTracker,
  args: {},
};

export const basic = {
  args: {},
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

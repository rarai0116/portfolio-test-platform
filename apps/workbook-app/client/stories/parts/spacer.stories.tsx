import { Meta, StoryObj, StoryFn } from "@storybook/react";
import Spacer from "../../components/parts/spacer";

type T = typeof Spacer;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Spacer",
  component: Spacer,
  args: {},
};

export const basic = {};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

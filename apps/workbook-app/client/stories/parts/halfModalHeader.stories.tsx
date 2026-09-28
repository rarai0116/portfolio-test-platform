import { Meta, StoryObj, StoryFn } from "@storybook/react";
import HalfModalHeader from "../../components/parts/halfModalHeader";

type T = typeof HalfModalHeader;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/HalfModalHeader",
  component: HalfModalHeader,
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

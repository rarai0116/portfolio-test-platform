import { Meta, StoryObj, StoryFn } from "@storybook/react";
import UserIcon from "../../components/organisms/userIcon";

type T = typeof UserIcon;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/UserIcon",
  component: UserIcon,
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

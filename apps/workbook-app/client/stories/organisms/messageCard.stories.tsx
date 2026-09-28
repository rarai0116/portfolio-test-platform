import { Meta, StoryObj, StoryFn } from "@storybook/react";
import MessageCard from "../../components/organisms/messageCard";

type T = typeof MessageCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/MessageCard",
  component: MessageCard,
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

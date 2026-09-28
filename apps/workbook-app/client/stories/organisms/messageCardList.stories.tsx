import { Meta, StoryObj, StoryFn } from "@storybook/react";
import MessageCardList from "../../components/organisms/messageCardList";

type T = typeof MessageCardList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/MessageCardList",
  component: MessageCardList,
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

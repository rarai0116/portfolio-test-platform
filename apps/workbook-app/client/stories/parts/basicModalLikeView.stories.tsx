import { Meta, StoryObj, StoryFn } from "@storybook/react";
import BasicModalLikeView from "../../components/parts/basicModalLikeView";

type T = typeof BasicModalLikeView;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/BasicModalLikeView",
  component: BasicModalLikeView,
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

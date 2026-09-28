import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ModalLikeView from "../../components/identities/modalLikeView";

type T = typeof ModalLikeView;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Identities/ModalLikeView",
  component: ModalLikeView,
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

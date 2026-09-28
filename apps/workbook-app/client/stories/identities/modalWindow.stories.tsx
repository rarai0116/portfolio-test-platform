import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ModalWindow from "../../components/identities/modalWindow";

type T = typeof ModalWindow;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Identities/ModalWindow",
  component: ModalWindow,
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

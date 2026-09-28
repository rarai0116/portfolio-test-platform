import { Meta, StoryObj, StoryFn } from "@storybook/react";
import InquiryFormModal from "../../components/organisms/inquiryFormModal";

type T = typeof InquiryFormModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/InquiryFormModal",
  component: InquiryFormModal,
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

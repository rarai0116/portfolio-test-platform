import { Meta, StoryObj, StoryFn } from "@storybook/react";
import InquiryFormSubmitCompletedModal from "../../components/organisms/inquiryFormSubmitCompletedModal";

type T = typeof InquiryFormSubmitCompletedModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/InquiryFormSubmitCompletedModal",
  component: InquiryFormSubmitCompletedModal,
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

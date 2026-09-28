import { Meta, StoryObj, StoryFn } from "@storybook/react";
import InquiryFormSubmitFailedModal from "../../components/organisms/inquiryFormSubmitFailedModal";

type T = typeof InquiryFormSubmitFailedModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/InquiryFormSubmitFailedModal",
  component: InquiryFormSubmitFailedModal,
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

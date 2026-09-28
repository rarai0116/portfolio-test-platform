import { Meta, StoryObj, StoryFn } from "@storybook/react";
import InquiryFormAskSubmitModal from "../../components/organisms/inquiryFormAskSubmitModal";

type T = typeof InquiryFormAskSubmitModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/InquiryFormAskSubmitModal",
  component: InquiryFormAskSubmitModal,
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

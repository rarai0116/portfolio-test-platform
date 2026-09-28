import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingOverwriteCompletedModal from "../../components/organisms/questionSettingOverwriteCompletedModal";

type T = typeof QuestionSettingOverwriteCompletedModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingOverwriteCompletedModal",
  component: QuestionSettingOverwriteCompletedModal,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExamQuestionSettingModal from "../../components/organisms/examQuestionSettingModal";

type T = typeof ExamQuestionSettingModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ExamQuestionSettingModal",
  component: ExamQuestionSettingModal,
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

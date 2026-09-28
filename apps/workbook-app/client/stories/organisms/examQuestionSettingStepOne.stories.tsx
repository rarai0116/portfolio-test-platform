import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExamQuestionSettingStepOne from "../../components/organisms/examQuestionSettingStepOne";

type T = typeof ExamQuestionSettingStepOne;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ExamQuestionSettingStepOne",
  component: ExamQuestionSettingStepOne,
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

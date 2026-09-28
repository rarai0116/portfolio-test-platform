import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExamQuestionSettingStepTwo from "../../components/organisms/examQuestionSettingStepTwo";

type T = typeof ExamQuestionSettingStepTwo;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ExamQuestionSettingStepTwo",
  component: ExamQuestionSettingStepTwo,
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

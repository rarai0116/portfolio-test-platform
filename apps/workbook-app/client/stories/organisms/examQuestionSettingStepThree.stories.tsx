import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExamQuestionSettingStepThree from "../../components/organisms/examQuestionSettingStepThree";

type T = typeof ExamQuestionSettingStepThree;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ExamQuestionSettingStepThree",
  component: ExamQuestionSettingStepThree,
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

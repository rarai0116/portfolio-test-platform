import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionSettingStepTwo from "../../components/organisms/practiceQuestionSettingStepTwo";

type T = typeof PracticeQuestionSettingStepTwo;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionSettingStepTwo",
  component: PracticeQuestionSettingStepTwo,
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

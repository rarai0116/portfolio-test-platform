import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionSettingStepFive from "../../components/organisms/practiceQuestionSettingStepFive";

type T = typeof PracticeQuestionSettingStepFive;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionSettingStepFive",
  component: PracticeQuestionSettingStepFive,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionSettingStepFour from "../../components/organisms/practiceQuestionSettingStepFour";

type T = typeof PracticeQuestionSettingStepFour;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionSettingStepFour",
  component: PracticeQuestionSettingStepFour,
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

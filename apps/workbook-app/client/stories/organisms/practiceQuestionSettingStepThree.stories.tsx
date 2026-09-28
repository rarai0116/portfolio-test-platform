import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionSettingStepThree from "../../components/organisms/practiceQuestionSettingStepThree";

type T = typeof PracticeQuestionSettingStepThree;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionSettingStepThree",
  component: PracticeQuestionSettingStepThree,
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

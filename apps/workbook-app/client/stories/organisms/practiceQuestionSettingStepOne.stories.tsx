import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionSettingStepOne from "../../components/organisms/practiceQuestionSettingStepOne";

type T = typeof PracticeQuestionSettingStepOne;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionSettingStepOne",
  component: PracticeQuestionSettingStepOne,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionTimeRadioButtonInput from "../../components/organisms/practiceQuestionTimeRadioButtonInput";

type T = typeof PracticeQuestionTimeRadioButtonInput;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionTimeRadioButtonInput",
  component: PracticeQuestionTimeRadioButtonInput,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PracticeQuestionNumberInput from "../../components/organisms/practiceQuestionNumberInput";

type T = typeof PracticeQuestionNumberInput;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PracticeQuestionNumberInput",
  component: PracticeQuestionNumberInput,
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

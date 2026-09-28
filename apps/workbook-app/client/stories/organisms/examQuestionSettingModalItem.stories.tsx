import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ExamQuestionSettingModalItem from "../../components/organisms/examQuestionSettingModalItem";

type T = typeof ExamQuestionSettingModalItem;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ExamQuestionSettingModalItem",
  component: ExamQuestionSettingModalItem,
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

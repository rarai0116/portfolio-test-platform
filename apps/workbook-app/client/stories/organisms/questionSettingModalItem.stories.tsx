import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingModalItem from "../../components/organisms/practiceQuestionSettingModalItem";

type T = typeof QuestionSettingModalItem;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingModalItem",
  component: QuestionSettingModalItem,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingModal from "../../components/organisms/practiceQuestionSettingModal";

type T = typeof QuestionSettingModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingModal",
  component: QuestionSettingModal,
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

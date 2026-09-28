import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingAskSaveSettingModal from "../../components/organisms/questionSettingAskSaveSettingModal";

type T = typeof QuestionSettingAskSaveSettingModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingAskSaveSettingModal",
  component: QuestionSettingAskSaveSettingModal,
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

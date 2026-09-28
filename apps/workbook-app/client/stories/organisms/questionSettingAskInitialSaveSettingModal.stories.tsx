import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingAskInitialSaveSettingModal from "../../components/organisms/questionSettingAskInitialSaveSettingModal";

type T = typeof QuestionSettingAskInitialSaveSettingModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingAskInitialSaveSettingModal",
  component: QuestionSettingAskInitialSaveSettingModal,
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

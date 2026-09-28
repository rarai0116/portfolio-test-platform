import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingSaveAsNewTextInputModal from "../../components/organisms/questionSettingSaveAsNewTextInputModal";

type T = typeof QuestionSettingSaveAsNewTextInputModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingSaveAsNewTextInputModal",
  component: QuestionSettingSaveAsNewTextInputModal,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionSettingSaveAsNewCompletedModal from "../../components/organisms/questionSettingSaveAsNewCompletedModal";

type T = typeof QuestionSettingSaveAsNewCompletedModal;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/QuestionSettingSaveAsNewCompletedModal",
  component: QuestionSettingSaveAsNewCompletedModal,
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

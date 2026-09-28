import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SwitchQuestionBoxes from "../../components/organisms/switchQuestionBoxes";

type T = typeof SwitchQuestionBoxes;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/SwitchQuestionBoxes",
  component: SwitchQuestionBoxes,
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

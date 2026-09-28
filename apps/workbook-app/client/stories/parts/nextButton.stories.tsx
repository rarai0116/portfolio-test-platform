import { Meta, StoryObj, StoryFn } from "@storybook/react";
import NextButton from "../../components/parts/nextButton";

type T = typeof NextButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/NextButton",
  component: NextButton,
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

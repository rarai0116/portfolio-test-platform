import { Meta, StoryObj, StoryFn } from "@storybook/react";
import RightArrowButton from "../../components/parts/rightArrowButton";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";

type T = typeof RightArrowButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/RightArrowButton",
  component: RightArrowButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider>
    <RightArrowButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    size: 32,
    color: "#BABABA",
  },
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

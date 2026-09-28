import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CardButton from "../../components/parts/cardButton";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";

type T = typeof CardButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/CardButton",
  component: CardButton,
  args: {},
};
const Template: Story = (args) => (
  <ButtonContextProvider>
    <CardButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    width: "160px",
    height: "88px",
    text: "hoge",
  },
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ThirdlyShortButton from "../../components/parts/thirdlyShortButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof ThirdlyShortButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/ThirdlyShortButton",
  component: ThirdlyShortButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <ThirdlyShortButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Short",
  },
};

export default meta;

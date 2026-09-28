import { Meta, StoryObj, StoryFn } from "@storybook/react";
import AlertLongButton from "../../components/parts/alertLongButton";
import {
  ButtonContextProvider,
  ButtonStates,
} from "../../components/hooks/useButtonContext";

type T = typeof AlertLongButton;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/Button/AlertLongButton",
  component: AlertLongButton,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider state={ButtonStates.released}>
    <AlertLongButton {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    text: "Long",
  },
};

export default meta;

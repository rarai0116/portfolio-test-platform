import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SecondaryShortButtonWithArrowFooter from "../../components/organisms/secondaryShortButtonWithArrowFooter";
import { ButtonStates } from "../../components/hooks/useButtonContext";

type T = typeof SecondaryShortButtonWithArrowFooter;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/SecondaryShortButtonWithArrowFooter",
  component: SecondaryShortButtonWithArrowFooter,
  args: {},
};

export const basic = {
  args: {
    onPressOutSecondaryButton() {
      console.info("onPressOutSecondaryButton");
    },
    buttonText: "ボタン",
  },
};

export default meta;

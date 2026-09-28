import { Meta, StoryObj, StoryFn } from "@storybook/react";
import PrimaryShortButtonFooter from "../../components/organisms/primaryShortButtonFooter";
import { ButtonStates } from "../../components/hooks/useButtonContext";

type T = typeof PrimaryShortButtonFooter;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/PrimaryShortButtonFooter",
  component: PrimaryShortButtonFooter,
  args: {},
};

export const basic = {
  args: {
    buttonState: ButtonStates.released,
    onPressOut() {
      console.info("onPressOut");
    },
    buttonText: "ボタン",
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

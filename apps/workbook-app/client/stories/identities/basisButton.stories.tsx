import { Meta, StoryObj, StoryFn } from "@storybook/react";
import BasisButton from "../../components/identities/button";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";

const Template: StoryFn = (args) => (
  <ButtonContextProvider>
    <BasisButton {...args} />
  </ButtonContextProvider>
);

export const Primary = Template.bind({
  args: {
    width: "240px",
    height: "40px",
    releasedButtonStyle: ["rounded-md", "bg-workbookblue-500"],
    pressedButtonStyle: ["rounded-md", "bg-workbookblue-600"],
    disabledButtonStyle: ["rounded-md", "bg-workbookblue-100"],
  },
});

const parts = {
  title: "Identities/BasisButton",
  component: BasisButton,
  decorators: [Primary],
} satisfies Meta<typeof BasisButton>;

export default parts;

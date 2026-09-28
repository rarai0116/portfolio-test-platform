import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SettingCard from "../../components/organisms/settingCard";
import ModalManagerContextProvider from "../../components/hooks/useModalManagerContext";

type T = typeof SettingCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/SettingCard",
  component: SettingCard,
  args: {},
};

const Template: Story = (args) => (
  <ModalManagerContextProvider>
    <SettingCard {...args} />
  </ModalManagerContextProvider>
);

export const basic = {
  render: Template,
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

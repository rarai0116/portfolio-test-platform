import { Meta, StoryObj, StoryFn } from "@storybook/react";
import SavedSetting from "../../components/views/calendarView/organisms/calendarSavedSetting";

type T = typeof SavedSetting;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/SavedSetting",
  component: SavedSetting,
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

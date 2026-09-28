import { Meta, StoryObj, StoryFn } from "@storybook/react";
import TaskSettingCalendar from "../../components/views/calendarView/organisms/taskSettingCalendar";

type T = typeof TaskSettingCalendar;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/TaskSettingCalendar",
  component: TaskSettingCalendar,
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

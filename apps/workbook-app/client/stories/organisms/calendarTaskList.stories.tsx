import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CalendarTaskList from "../../components/views/calendarView/organisms/calendarTaskList";

type T = typeof CalendarTaskList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/CalendarTaskList",
  component: CalendarTaskList,
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

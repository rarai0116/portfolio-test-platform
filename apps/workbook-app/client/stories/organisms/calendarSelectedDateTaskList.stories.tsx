import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CalendarSelectedDateTaskList from "../../components/views/calendarView/organisms/calendarSelectedDateTaskList";

type T = typeof CalendarSelectedDateTaskList;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/CalendarSelectedDateTaskList",
  component: CalendarSelectedDateTaskList,
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

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import TimerBarPart from "../../components/parts/timerBarPart";
import { TimeLimitContextProvider } from "../../components/hooks/useTimeLimitContext";

type T = typeof TimerBarPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/TimerBarPart",
  component: TimerBarPart,
  args: {},
};

const Template: Story = (args) => (
  <TimeLimitContextProvider timeLimit={10_000}>
    <TimerBarPart {...args} />
  </TimeLimitContextProvider>
);

export const basic = {
  render: Template,

  args: {
    isStart: true,
  },
};

export default meta;

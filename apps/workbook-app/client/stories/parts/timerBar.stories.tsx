import { Meta, StoryObj, StoryFn } from "@storybook/react";
import TimerBar from "../../components/parts/timerBar";
import { TimeLimitContextProvider } from "../../components/hooks/useTimeLimitContext";

type T = typeof TimerBar;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/TimerBar",
  component: TimerBar,
  args: {},
};

const Template: Story = (args) => (
  <TimeLimitContextProvider timeLimit={20_000}>
    <TimerBar {...args} />
  </TimeLimitContextProvider>
);

export const basic = {
  render: Template,

  args: {
    isTimerVisible: true,
    isStart: false,
  },
};

export default meta;

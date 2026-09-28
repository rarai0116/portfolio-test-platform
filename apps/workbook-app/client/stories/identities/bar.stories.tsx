import { Meta, StoryObj } from "@storybook/react";
import Bar from "../../components/identities/bar";

const meta = {
  title: "Identities/Bar",
  component: Bar,
  args: {},
} satisfies Meta<typeof Bar>;

meta.args = {
  barStyle: {
    container: "w-100 h-4 bg-quaternary rounded-2xl clipPath_round",
    bar: "h-4 bg-successgreen-400 rounded-l-2xl",
    borderRadius: "rounded-r-2xl",
  },
  percent: 80.25,
};

type Story = StoryObj<typeof Bar>;

export default meta;

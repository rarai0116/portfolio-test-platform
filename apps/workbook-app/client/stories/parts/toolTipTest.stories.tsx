import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ToolTipTest from "../../components/parts/toolTipTest";

type T = typeof ToolTipTest;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ToolTipTest",
  component: ToolTipTest,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

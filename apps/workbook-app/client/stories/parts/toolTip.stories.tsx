import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ToolTip from "../../components/parts/toolTip";

type T = typeof ToolTip;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/ToolTip",
  component: ToolTip,
  args: {},
};

export const basic = {
  args: {
    toolTipText: "出題カテゴリ―や条件の選択によって絞り込まれた問題数です",
    textPosition: "",
  },
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import LoadingBar from "../../components/parts/loadingBar";

type T = typeof LoadingBar;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/LoadingBar",
  component: LoadingBar,
  args: {},
};

export const basic = {
  args: {
    title: "ローディング中...",
    loadedTitle: "ローディング完了！",
    percent: 10.25,
  },
};

export default meta;

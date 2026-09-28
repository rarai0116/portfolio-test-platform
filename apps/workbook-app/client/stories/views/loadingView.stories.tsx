import { Meta, StoryObj, StoryFn } from "@storybook/react";
import LoadingView from "../../components/views/loadingView";

type T = typeof LoadingView;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Views/LoadingView",
  component: LoadingView,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

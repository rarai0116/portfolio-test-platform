import { Meta, StoryObj, StoryFn } from "@storybook/react";
import LoadingBackground from "../../components/organisms/loadingBackground";

type T = typeof LoadingBackground;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/LoadingBackground",
  component: LoadingBackground,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

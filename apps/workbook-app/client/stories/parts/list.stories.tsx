import { Meta, StoryObj, StoryFn } from "@storybook/react";
import List from "../../components/parts/list";
import DummyIcon from "../../assets/svg/dummy_30.svg";

type T = typeof List;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/List",
  component: List,
  args: {},
};

export const basic = {
  args: {
    icon: <DummyIcon width={16} height={16} />,
    hasIcon: true,
    title: "hogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehoge",
    hasAlert: true,
    hasArrow: true,
    onPressOut() {
      console.info("onPressOut");
    },
  },
};

export default meta;

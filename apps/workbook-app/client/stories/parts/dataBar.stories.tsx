import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataBar from "../../components/parts/dataBar";

type T = typeof DataBar;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/DataBar",
  component: DataBar,
  args: {},
};

export const example1 = {
  args: {
    percentArray: [50, 30, 20],
    label: [50, 30, 20],
    bgColor: ["red-100", "yellow-100", "green-100"],
    textStyle: [
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
    ],
    // barWidth:100
    barHeight: 50,
  },
};

export const example2 = {
  args: {
    percentArray: [0, 20, 80, 0, 0],
    label: [0, 10, 80, 0, 0],
    bgColor: ["red-100", "yellow-100", "green-100", "red-100", "yellow-100"],
    textStyle: [
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
    ],
    // barWidth:100
    barHeight: 50,
  },
};

export const example3 = {
  args: {
    percentArray: [0, 0, 100, 0, 0],
    label: [0, 0, 100, 0, 0],
    bgColor: ["red-100", "yellow-100", "green-100", "red-100", "yellow-100"],
    textStyle: [
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
      ["text-s", "text-primary"],
    ],
    // barWidth:100
    barHeight: 50,
  },
};

// 名前にColorを入れるとwarningが出る
// Addon controls: Control of type color only supports string, received "array" instead

export default meta;

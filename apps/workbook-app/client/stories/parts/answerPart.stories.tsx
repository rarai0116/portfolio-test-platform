import { Meta, StoryObj, StoryFn } from "@storybook/react";
import AnswerPart from "../../components/parts/answerPart";

type T = typeof AnswerPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/AnswerPart",
  component: AnswerPart,
  args: {},
};

export const basic = {
  args: {
    answerType: "正解",
    answerData: "1",
  },
};

export default meta;

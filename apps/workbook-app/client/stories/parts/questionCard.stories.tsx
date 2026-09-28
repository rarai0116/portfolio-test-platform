import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionCard from "../../components/parts/questionCard";

type T = typeof QuestionCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/QuestionCard",
  component: QuestionCard,
  args: {},
};

export const basic = {
  args: {
    questionNumber: "5",
    questionSentence:
      "住宅の動線計画に関する次の記述のうち、<strong>最も不適当な</strong>ものはどれか。この問題はダミーです。",
  },
};

export const test = {
  args: {
    questionNumber: "100",
    questionSentence:
      "hogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehogehoge",
  },
};

export default meta;

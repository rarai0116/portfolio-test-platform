import { Meta, StoryObj, StoryFn } from "@storybook/react";
import CorrectAnswerRateCard from "../../components/parts/correctAnswerRateCard";

type T = typeof CorrectAnswerRateCard;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/CorrectAnswerRateCard",
  component: CorrectAnswerRateCard,
  args: {},
};

export const basic = {
  args: {
    totalNumberOfQuestionsinTest: 200,
    numberOfCorrectAnswers: 160,
  },
};

export default meta;

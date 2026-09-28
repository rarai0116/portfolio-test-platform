import { Meta, StoryObj, StoryFn } from "@storybook/react";
import ChoicesFooter from "../../components/organisms/choicesFooter";
import { questionFormat } from "../../types/commonUnionType";

type T = typeof ChoicesFooter;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/ChoicesFooter",
  component: ChoicesFooter,
  args: {},
};

export const GradeOne = {
  args: {
    type: questionFormat.fourChoices,
  },
};

export const GradeTwo = {
  args: {
    type: questionFormat.fiveChoices,
  },
};

export const QandA = {
  args: {
    type: questionFormat.qAndA,
  },
};

export default meta;

import { Meta, StoryObj, StoryFn } from "@storybook/react";
import QuestionDataPart from "../../components/parts/questionDataPart";
import { TimeLimitContextProvider } from "../../components/hooks/useTimeLimitContext";
import GlobalSaveDataContextProvider from "../../components/hooks/useGlobalSaveDataContext";
import { questionSubject, questionGrade } from "../../types/commonUnionType";

type T = typeof QuestionDataPart;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Parts/QuestionDataPart",
  component: QuestionDataPart,
  args: {},
};

const Template: Story = (args) => (
  <GlobalSaveDataContextProvider>
    <TimeLimitContextProvider timeLimit={10_000_000}>
      <QuestionDataPart {...args} />
    </TimeLimitContextProvider>
  </GlobalSaveDataContextProvider>
);

export const basic = {
  render: Template,
  args: {},
};

export default meta;

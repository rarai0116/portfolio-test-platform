import { Meta, StoryObj, StoryFn } from "@storybook/react";
import GradeCardButtons from "../../components/organisms/gradeCardButtons";
import { ButtonContextProvider } from "../../components/hooks/useButtonContext";

type T = typeof GradeCardButtons;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/GradeCardButtons",
  component: GradeCardButtons,
  args: {},
};

const Template: Story = (args) => (
  <ButtonContextProvider>
    <GradeCardButtons {...args} />
  </ButtonContextProvider>
);

export const basic = {
  render: Template,

  args: {
    onPressOutGradeOne() {
      console.info("1級");
    },
    onPressOutGradeTwo() {
      console.info("2級");
    },
  },
};

export default meta;

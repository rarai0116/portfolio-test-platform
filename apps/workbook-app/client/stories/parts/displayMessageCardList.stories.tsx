import type { Meta, StoryObj } from "@storybook/react";
import DisplayMessageCardList from "../../components/parts/displayMessageCardList";

const meta = {
  title: "Parts/DisplayMessageCardList",
  component: DisplayMessageCardList,
  args: { list: [] },
} satisfies Meta<typeof DisplayMessageCardList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

import type { Meta, StoryObj } from "@storybook/react";
import { DisplaySettingCardList } from "../../components/parts/displaySettingCardList";

const meta = {
  title: "Parts/DisplaySettingCardList",
  component: DisplaySettingCardList,
  args: { list: [] },
} satisfies Meta<typeof DisplaySettingCardList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

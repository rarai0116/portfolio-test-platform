import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { StorybookPage } from "./StorybookPage";

const meta = {
  title: "Example/StorybookPage",
  component: StorybookPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StorybookPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {};

export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loginButton = await canvas.findByRole("button", { name: /log in/i });
    await userEvent.click(loginButton);
    await expect(canvas.getByText("Welcome, Jane Doe!")).toBeInTheDocument();
  },
};

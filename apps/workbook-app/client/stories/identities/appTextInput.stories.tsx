import { Meta, StoryObj } from "@storybook/react";
import AppTextInput from "../../components/identities/appTextInput";

type T = typeof AppTextInput;

const meta = {
  title: "Identities/AppTextInput",
  component: AppTextInput,
  args: {
    inputStyle: "w-11/12 py-1 px-2 border border-tertiary rounded",
    placeholder: "",
    // focusStyle: {{outlineColor: '#289DF4'}},
    maxLength: 20,
  },
} satisfies Meta<typeof AppTextInput>;

type Story = StoryObj<typeof AppTextInput>;

export default meta;

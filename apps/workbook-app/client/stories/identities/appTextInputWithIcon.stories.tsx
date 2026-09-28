import { Meta, StoryObj } from "@storybook/react";
import AppTextInputWithIcon from "../../components/identities/appTextInputWithIcon";
import PenIcon from "../../assets/svg/pen_common.svg";

const meta: Meta<typeof AppTextInputWithIcon> = {
  title: "Identities/AppTextInputWithIcon",
  component: AppTextInputWithIcon,
  args: {
    inputStyle: "",
    placeholder: "ユーザー名",
    placeholderTextColor: "#3F3F3F",
    maxLength: 20,
    icon: <PenIcon fill="#BABABA" width={14} height={14} />,
  },
};

type Story = StoryObj<typeof AppTextInputWithIcon>;

export default meta;

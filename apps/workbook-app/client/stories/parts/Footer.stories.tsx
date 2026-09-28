import { Meta, StoryObj, StoryFn } from "@storybook/react";
import Footer from "../../components/identities/Footer";

type T = typeof Footer;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Identities/Footer",
  component: Footer,
  args: {},
};

export const basic = {
  args: {},
};

export default meta;

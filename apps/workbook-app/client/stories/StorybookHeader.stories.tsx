import React from "react";
import { StoryFn, Meta } from "@storybook/react";

import { StorybookHeader } from "./StorybookHeader";

export default {
  title: "Example/StorybookHeader",
  component: StorybookHeader,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "fullscreen",
  },
} as Meta<typeof StorybookHeader>;

export const LoggedIn = {
  args: {
    user: {
      name: "Jane Doe",
    },
  },
};

export const LoggedOut = {
  args: {},
};

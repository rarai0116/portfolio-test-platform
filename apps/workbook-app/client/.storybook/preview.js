import {INITIAL_VIEWPORTS} from "storybook/viewport";

export const parameters = {
  layout: 'fullscreen',
/*  actions: { argTypesRegex: "^on[A-Z].*" },*/
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  viewport: {
    options: INITIAL_VIEWPORTS
  }
}
export const tags = ["autodocs"];

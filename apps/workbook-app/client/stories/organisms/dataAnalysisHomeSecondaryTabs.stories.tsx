import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisHomeSecondaryTabs from "../../components/views/dataAnalysisHomeView/dataAnalysisHomeSecondaryTabsView";

type T = typeof DataAnalysisHomeSecondaryTabs;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/DataAnalysisHomeSecondaryTabs",
  component: DataAnalysisHomeSecondaryTabs,
  args: {},
};

export const basic = {
  args: {},
};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

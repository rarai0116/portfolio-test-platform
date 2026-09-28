import { Meta, StoryObj, StoryFn } from "@storybook/react";
import DataAnalysisCategorySecondaryTabsView from "../../components/views/dataAnalysisHomeView/dataAnalysisCategorySecondaryTabsView";

type T = typeof DataAnalysisCategorySecondaryTabsView;
type Story = StoryFn<T>;

const meta: Meta<T> = {
  title: "Organisms/DataAnalysisCategorySecondaryTabs",
  component: DataAnalysisCategorySecondaryTabsView,
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

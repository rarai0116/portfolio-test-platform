---
to: "<%= skipStories ? null : `stories/${h.changeCase.camelCase(category)}/${h.changeCase.camelCase(name)}.stories.tsx` %>"
---
import {Meta, StoryObj} from '@storybook/react';
import <%= h.changeCase.pascalCase(name) %> from '../../components/<%= h.changeCase.camelCase(category) %>/<%= h.changeCase.camelCase(name) %>';

type T = typeof <%= h.changeCase.pascalCase(name) %>
type Meta = ComponentMeta<T>;
type Story = ComponentStory<T>;

const meta:Meta = {
  title: '<%- category %>/<%= h.changeCase.pascalCase(name) %>',
  component: <%= h.changeCase.pascalCase(name) %>,
  <% if (haveProps) { -%>
  args: {},
  <% } -%>
};

const Template: Story = (args) => (
	<<%= h.changeCase.pascalCase(name) %> {...args} />
);
export const basic = Template.bind({});
basic.args = {};

/*
export const Primary = Template.bind({});
Primary.args = {
  primary: true,
  label: 'XXX',
};
*/

export default meta;

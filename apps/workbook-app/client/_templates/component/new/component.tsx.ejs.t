---
to: components/<%= h.changeCase.camelCase(category) %>/<%= h.changeCase.camelCase(name) %>.tsx
---
import {Text, View, Button, Image} from 'react-native';
<% if (haveProps) { -%>
import {useState, useCallback} from 'react';
<% } -%>
<% if (category === 'Views') { -%>
import {useNavigation} from '@react-navigation/native';
import type {RootViewsProps, TestViewsProps} from '../../types/viewPrameter';
<% } -%>
<% if (category !== 'Pages') { -%>
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

<% } -%>
<% if (haveProps) { -%>

export type <%= h.changeCase.pascalCase(name) %>Props = {};
<% } -%>

<% const props = haveProps ? `(props: ${h.changeCase.pascalCase(name)}Props)` : '()'; -%>

const <%= h.changeCase.pascalCase(name) %> = <%- props %> => {
<% if (haveHooks) { -%>
	const [state, setState] = useState(<%- initialState %>);
	<% if (hooksType === 'Boolean') { -%>
	const toggle = useCallback(() => {
		setState((b) => !b);
	}, []);
		<% } -%>
<% } -%>
<% if (category === 'Views') { -%>
		const navigation = useNavigation<RootViewsProps<'Test'>['navigation']>();
	<% } -%>
	return (
	<View>
		<% if (category !== 'Pages') { -%>
		<AppText style={tw`text-workbookblue-300`}>Hello World</AppText>
		<% } -%>
		<% if (category === 'Views') { -%>
			<Button
				title="XXX"
				onPress={() => {
					navigation.navigate('Test', {screen: 'TestHome'});
				}}
			/>
		<% } -%>
	</View>
	);
};

export default <%= h.changeCase.pascalCase(name) %>;

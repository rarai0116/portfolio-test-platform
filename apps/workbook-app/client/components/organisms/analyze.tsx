import {View} from 'react-native';
import tw from '../../tailwind.custom';

const SettingTest: React.FC = () => {
  return <View style={tw`flex flex-col flex-nowrap container`}>hoge</View>;
};

/*
Const styles = StyleSheet.create({
	header: {
		backgroundColor: '#F8F8F8',
		justifyContent: 'center',
		alignItems: 'center',
		height: 60,
		paddingTop: 15,
		elevation: 2,
		position: 'relative',
	},
	headerText: {
		fontSize: 20,
		fontWeight: '600',
	},
});
*/

export default SettingTest;

import {View} from 'react-native';
import tw from '../../tailwind.custom';

export type BarProps = {
  readonly barStyle?: {container: string; bar: string; borderRadius: string};
  readonly percent: number;
};

const Bar = (props: BarProps) => {
  const {barStyle = {container: '', bar: '', borderRadius: ''}} = props; // 初期値
  const flooredPercent = Math.floor(props.percent);
  return (
    <View style={tw`${barStyle.container}`}>
      <View
        style={tw.style(
          `w-[${String(flooredPercent)}%]`,
          barStyle.bar,
          flooredPercent >= 100 ? barStyle.borderRadius : null,
        )}
      />
    </View>
  );
};

export default Bar;

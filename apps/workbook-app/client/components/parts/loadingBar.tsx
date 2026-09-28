import {View} from 'react-native';
import {useState, useEffect} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import Bar from '../identities/bar';
import Spacer from './spacer';

export type LoadingBarProps = {
  readonly title: string;
  readonly loadedTitle: string;
  readonly percent: number;
};

const LoadingBar = (props: LoadingBarProps) => {
  const flooredPercent = Math.floor(props.percent * 10) / 10;
  // 表示上のパーセント(小数点第一位まで表示)
  const percentText = flooredPercent.toString().includes('.')
    ? flooredPercent
    : `${flooredPercent}.0`;
  const [title, setTitle] = useState<string>(props.title);

  useEffect(() => {
    // console.log(`${props.percent} %`);
    if (props.percent >= 100) {
      setTitle(props.loadedTitle);
    }
  }, [props.percent, props.loadedTitle]);

  return (
    <View style={tw`items-center`}>
      <View style={tw`w-3/4`}>
        <View style={tw`items-center`}>
          <AppText style={tw`text-white text-xl`}>{title}</AppText>
        </View>
        <Spacer isHorizontal={false} size={24} />
        <Bar
          barStyle={{
            container: 'w-full h-4 bg-quaternary rounded-2xl clipPath_round',
            bar: 'h-4 bg-workbookblue-500 rounded-l-2xl',
            borderRadius: 'rounded-r-2xl',
          }}
          percent={props.percent}
        />
        <Spacer isHorizontal={false} size={12} />
        <View style={tw`items-end`}>
          <AppText style={tw`text-white text-base`}>{percentText}%</AppText>
        </View>
      </View>
    </View>
  );
};

export default LoadingBar;

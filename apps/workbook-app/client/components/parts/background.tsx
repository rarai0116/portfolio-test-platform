import {View, useWindowDimensions} from 'react-native';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';

export type BackgroundProps = {
  readonly children?: ReactNode;
};

const Background = (props: BackgroundProps) => {
  const {height} = useWindowDimensions();
  // console.log(height);
  return (
    <View style={tw`bg-background min-h-[${height}px] grow`}>
      {props.children}
    </View>
  );
};

export default Background;

import {type LayoutChangeEvent, View} from 'react-native';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';

export type FooterProps = {
  readonly children?: ReactNode;
  readonly handleLayout?: (event: LayoutChangeEvent) => void;
  // ReactNativeModalの中にある場合styleを調整する必要あり
  readonly isInReactNativeModal?: boolean;
};

const Footer = (props: FooterProps) => {
  return (
    <View
      style={tw.style(
        `absolute self-end bottom-0 w-100% px-5 bg-white justify-center ${
          props.isInReactNativeModal /* && Platform.OS === 'ios' */
            ? `h-30 pb-4`
            : `h-24`
        }`,
      )}
      onLayout={props.handleLayout}
    >
      <View style={tw`justify-center`}>{props.children}</View>
    </View>
  );
};

export default Footer;

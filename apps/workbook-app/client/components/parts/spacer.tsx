import {View} from 'react-native';
import tw from '../../tailwind.custom';

export type SpacerProps = {
  readonly size: number;
  readonly isHorizontal?: boolean;
};

const Spacer = (props: SpacerProps) => {
  return (
    <View
      style={
        props.isHorizontal
          ? tw.style([`w-${props.size}px`, 'h-auto'])
          : tw.style(['w-auto', `h-${props.size}px`])
      }
    />
  );
};

export default Spacer;

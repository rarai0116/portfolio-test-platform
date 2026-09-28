import {View} from 'react-native';
import tw from '../../tailwind.custom';
import {ButtonContextProvider} from '../hooks/useButtonContext';
import type {ButtonStateType} from '../hooks/useButtonContext';
import PrimaryShortButton from '../parts/primaryShortButton';

export type PrimaryShortButtonFooterProps = {
  readonly buttonState: ButtonStateType;
  readonly onPressOut: () => void;
  readonly buttonText: string;
};

const PrimaryShortButtonFooter = (props: PrimaryShortButtonFooterProps) => {
  return (
    <View style={tw`w-full items-center py-6`}>
      <ButtonContextProvider
        state={props.buttonState}
        onPressOut={props.onPressOut}
      >
        <PrimaryShortButton text={props.buttonText} />
      </ButtonContextProvider>
      {/* {Platform.OS === 'android' ? (
          <Spacer isHorizontal={false} size={20} />
        ) : null} */}
    </View>
  );
};

export default PrimaryShortButtonFooter;

import {type LayoutChangeEvent, View} from 'react-native';
import tw from '../../tailwind.custom';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import SecondaryShortButton from '../parts/secondaryShortButton';
import RightArrowButton from '../parts/rightArrowButton';

export type SecondaryShortButtonWithArrowFooterProps = {
  readonly buttonText: string;
  readonly onPressOutSecondaryButton: () => void;
  readonly onPressOutRightArrow?: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
};

const SecondaryShortButtonWithArrowFooter = (
  props: SecondaryShortButtonWithArrowFooterProps,
) => {
  return (
    <View
      style={tw.style(
        `absolute self-end bottom-0 w-100% px-5 bg-white justify-center py-4 `,
      )}
      onLayout={props.onLayout}
    >
      <View style={tw`justify-center`}>
        <View style={tw`items-center`}>
          <ButtonContextProvider
            state={ButtonStates.released}
            onPressOut={props.onPressOutSecondaryButton}
          >
            <SecondaryShortButton text={props.buttonText} />
          </ButtonContextProvider>
        </View>
        {props.onPressOutRightArrow ? (
          <View style={tw`absolute right-0`}>
            <ButtonContextProvider
              state={ButtonStates.released}
              onPressOut={props.onPressOutRightArrow}
            >
              <RightArrowButton size={32} color="#BABABA" />
            </ButtonContextProvider>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default SecondaryShortButtonWithArrowFooter;

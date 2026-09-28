import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {
  ButtonContextProvider,
  type ButtonStateType,
} from '../hooks/useButtonContext';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type CardButtonProps = {
  readonly width: string;
  readonly height: string;
  readonly text?: string;
  readonly children: ReactNode;
  readonly onPressOut?: () => void;
  readonly buttonState?: ButtonStateType;
};

const CardButton = (props: CardButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton
        width={props.width}
        height={props.height}
        pressedOpacity={1}
        releasedButtonStyle={[
          'rounded-md bg-white border-solid border-b-2 border-r-2 border-quaternary',
        ]}
        pressedButtonStyle={[
          'rounded-md bg-quaternary border-solid border-b-2 border-r-2 border-quaternary',
        ]}
        disabledButtonStyle={[
          'rounded-md bg-quaternary border-solid border-b-2 border-r-2 border-quaternary',
        ]}
      >
        {props.children}
        <Spacer isHorizontal={false} size={4} />
        <AppText style={tw`text-base text-primary`}>{props.text}</AppText>
      </BasisButton>
    </ButtonContextProvider>
  );
};

export default CardButton;

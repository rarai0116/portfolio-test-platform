import {Image, View} from 'react-native';
import {useContext} from 'react';
import type {ReactNode} from 'react';
import type {ImageSourcePropType} from 'react-native';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {
  ButtonContextProvider,
  ButtonContext,
  ButtonStates,
} from '../hooks/useButtonContext';
import googleLogoNormal from '../../assets/png/btn_google_signin_dark_normal_web.png';
import googleLogoPressed from '../../assets/png/btn_google_signin_dark_pressed_web.png';
import Spacer from './spacer';

export type CardButtonProps = {
  readonly width: string;
  readonly height: string;
  readonly children?: ReactNode;
  readonly onPress: () => void;
};

const ButtonInnerImage = () => {
  const {buttonState} = useContext(ButtonContext);
  const GoogleLogoNormal = googleLogoNormal as ImageSourcePropType;
  const GoogleLogoPressed = googleLogoPressed as ImageSourcePropType;
  return (
    <Image
      source={
        buttonState === ButtonStates.released
          ? GoogleLogoNormal
          : GoogleLogoPressed
      }
    />
  );
};

const GoogleSignInBotton = (props: CardButtonProps) => {
  return (
    <ButtonContextProvider onPressOut={props.onPress}>
      <BasisButton
        width={props.width}
        height={props.height}
        pressedOpacity={1}
        releasedButtonStyle={[]}
        pressedButtonStyle={[]}
        disabledButtonStyle={[]}
      >
        <View style={tw`items-center`}>
          {props.children}
          <Spacer isHorizontal={false} size={4} />
          <ButtonInnerImage />
        </View>
      </BasisButton>
    </ButtonContextProvider>
  );
};

export default GoogleSignInBotton;

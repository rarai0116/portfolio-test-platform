import {useEffect, useState, useContext, useRef} from 'react';
import type {Pressable} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {ButtonStates, ButtonContext} from '../hooks/useButtonContext';
import AppText from '../identities/appText';

export type SecondaryShortButtonProps = {
  readonly text?: string;
};

const SecondaryShortButton = (props: SecondaryShortButtonProps) => {
  /* タッチ状態の変更によるスタイルの変更 */
  const {buttonState} = useContext(ButtonContext);
  const [style, setStyle] = useState(tw`text-base text-workbookblue-500`);
  useEffect(() => {
    switch (buttonState) {
      case ButtonStates.pressed: {
        setStyle(tw`text-base text-workbookblue-500`);
        break;
      }

      case ButtonStates.released: {
        setStyle(tw`text-base text-workbookblue-500`);
        break;
      }

      case ButtonStates.disabled: {
        setStyle(tw`text-base text-workbookblue-200`);
        break;
      }
    }
  }, [buttonState]);
  const [_press, setPress] = useState(false);
  const _BasisButtonRef = useRef<typeof Pressable>(null);
  // console.log(BasisButtonRef.current);
  return (
    <BasisButton
      width="200px"
      height="40px"
      pressedOpacity={1}
      releasedButtonStyle={[
        'rounded-md',
        'bg-white',
        'border-solid',
        'border-[0.5px]',
        'border-workbookblue-500',
      ]}
      pressedButtonStyle={[
        'rounded-md',
        'bg-workbookblue-100',
        'border-solid',
        'border-[0.5px]',
        'border-workbookblue-500',
      ]}
      disabledButtonStyle={[
        'rounded-md',
        'bg-quaternary',
        'border-solid',
        'border-[0.5px]',
        'border-workbookblue-500',
      ]}
      onPressIn={() => {
        setPress(true);
        // console.log('タッチ');
      }}
      onPressOut={() => {
        setPress(false);
        // console.log('out');
      }}
    >
      <AppText style={style}>{props.text}</AppText>
    </BasisButton>
  );
};

export default SecondaryShortButton;

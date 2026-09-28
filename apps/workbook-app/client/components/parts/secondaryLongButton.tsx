import {useEffect, useState, useContext} from 'react';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {ButtonStates, ButtonContext} from '../hooks/useButtonContext';
import AppText from '../identities/appText';

export type SecondaryLongButtonProps = {readonly text?: string};

const SecondaryLongButton = (props: SecondaryLongButtonProps) => {
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
  return (
    <BasisButton
      width="240px"
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
        'border-workbookblue-200',
      ]}
    >
      <AppText style={style}>{props.text}</AppText>
    </BasisButton>
  );
};

export default SecondaryLongButton;

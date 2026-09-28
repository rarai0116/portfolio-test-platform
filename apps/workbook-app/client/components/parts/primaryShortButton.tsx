import {useEffect, useState, useContext} from 'react';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {ButtonStates, ButtonContext} from '../hooks/useButtonContext';
import AppText from '../identities/appText';

export type PrimaryShortButtonProps = {readonly text?: string};

const PrimaryShortButton = (props: PrimaryShortButtonProps) => {
  /* タッチ状態の変更によるスタイルの変更 */
  const {buttonState} = useContext(ButtonContext);
  const [style, setStyle] = useState(tw`font-bold text-base text-white`);
  useEffect(() => {
    switch (buttonState) {
      case ButtonStates.pressed: {
        setStyle(tw`font-bold text-base text-white`);
        break;
      }

      case ButtonStates.released: {
        setStyle(tw`font-bold text-base text-white`);
        break;
      }

      case ButtonStates.disabled: {
        setStyle(tw`font-bold text-base text-white`);
        break;
      }

      /*
      default: {
        setStyle(tw`font-bold text-base text-white`);
        break;
      }
      */
    }
  }, [buttonState]);
  return (
    <BasisButton
      width="200px"
      height="40px"
      pressedOpacity={1}
      releasedButtonStyle={['rounded-md', 'bg-workbookblue-500']}
      pressedButtonStyle={['rounded-md', 'bg-workbookblue-600']}
      disabledButtonStyle={['rounded-md', 'bg-workbookblue-100']}
    >
      <AppText style={style}>{props.text}</AppText>
    </BasisButton>
  );
};

export default PrimaryShortButton;

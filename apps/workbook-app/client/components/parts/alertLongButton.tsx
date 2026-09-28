import {useEffect, useState, useContext} from 'react';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import {ButtonStates, ButtonContext} from '../hooks/useButtonContext'; // タッチ状態を取得したい場合はこれをインポートする
import AppText from '../identities/appText';

export type AlertLongButtonProps = {readonly text?: string};

const AlertLongButton = (props: AlertLongButtonProps) => {
  /* タッチ状態の変更によるスタイルの変更 */
  const {buttonState} = useContext(ButtonContext);
  const [style, setStyle] = useState(tw`text-base text-errorred-400`);
  useEffect(() => {
    switch (buttonState) {
      case ButtonStates.pressed: {
        setStyle(tw`text-base text-errorred-400`);
        break;
      }

      case ButtonStates.released: {
        setStyle(tw`text-base text-errorred-400`);
        break;
      }

      case ButtonStates.disabled: {
        setStyle(tw`text-base text-errorred-100`);
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
        'border',
        'border-errorred-400',
      ]}
      pressedButtonStyle={[
        'rounded-md',
        'bg-errorred-50',
        'border-solid',
        'border',
        'border-errorred-400',
      ]}
      disabledButtonStyle={[
        'rounded-md',
        'bg-quaternary',
        'border-solid',
        'border',
        'border-errorred-400',
      ]}
    >
      <AppText style={style}>{props.text}</AppText>
    </BasisButton>
  );
};

export default AlertLongButton;

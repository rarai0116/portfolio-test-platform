import {useEffect, useState} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import type {ButtonStateType} from '../hooks/useButtonContext';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import RightArrowIcon from '../../assets/svg/right-arrow.svg';
import BasisButton from '../identities/button';

export type NextButtonProps = {
  readonly onPressOut: () => void;
  readonly buttonState: ButtonStateType;
};

const NextButton = (props: NextButtonProps) => {
  const [style, setStyle] = useState(tw`text-workbookblue-500`);
  const [iconColor, setIconColor] = useState('#289DF4');
  useEffect(() => {
    switch (props.buttonState) {
      case ButtonStates.pressed: {
        setStyle(tw`text-workbookblue-500 text-base`);
        setIconColor('#289DF4');
        break;
      }

      case ButtonStates.released: {
        setStyle(tw`text-workbookblue-500 text-base`);
        setIconColor('#289DF4');
        break;
      }

      case ButtonStates.disabled: {
        setStyle(tw`text-tertiary text-base`);
        setIconColor('#BABABA');
        break;
      }
    }
  }, [props.buttonState]);
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton
        width="80px"
        height="72px"
        releasedButtonStyle={['flex-row']}
        pressedButtonStyle={['flex-row', 'rounded-full', 'bg-workbookblue-50']}
        disabledButtonStyle={['flex-row']}
      >
        <AppText style={style}>次へ</AppText>
        <RightArrowIcon fill={iconColor} width={32} height={32} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

export default NextButton;

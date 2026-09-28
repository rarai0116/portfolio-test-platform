import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import LeftArrowIcon from '../../assets/svg/left-arrow.svg';
import BasisButton from '../identities/button';

export type BackButtonProps = {
  readonly onPressOut: () => void;
};

const BackButton = (props: BackButtonProps) => {
  return (
    <ButtonContextProvider
      state={ButtonStates.released}
      onPressOut={props.onPressOut}
    >
      <BasisButton
        width="80px"
        height="72px"
        releasedButtonStyle={['flex-row']}
        pressedButtonStyle={['flex-row', 'rounded-full', 'bg-workbookblue-50']}
        disabledButtonStyle={['rounded-full', 'bg-workbookblue-100']}
      >
        <LeftArrowIcon fill="#289DF4" width={32} height={32} />
        <AppText style={tw`text-workbookblue-500 text-base`}>戻る</AppText>
      </BasisButton>
    </ButtonContextProvider>
  );
};

export default BackButton;

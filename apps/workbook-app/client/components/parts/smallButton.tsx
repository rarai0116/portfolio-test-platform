import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import AppText from '../identities/appText';

export type SmallButtonProps = {readonly text: string; readonly width?: string};

const SmallButton = (props: SmallButtonProps) => {
  return (
    <BasisButton
      width={props.width}
      height="24px"
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
        'bg-workbookblue-50',
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
      <AppText style={tw`text-sm`}>{props.text}</AppText>
    </BasisButton>
  );
};

export default SmallButton;

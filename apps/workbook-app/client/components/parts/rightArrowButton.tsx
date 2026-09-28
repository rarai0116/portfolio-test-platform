import RightArrow from '../../assets/svg/right-arrow.svg';
import BasisButton from '../identities/button';

export type RightArrowButtonProps = {
  readonly size: number;
  readonly color: string;
};

const RightArrowButton = (props: RightArrowButtonProps) => {
  return (
    <BasisButton
      width={`${props.size + 8}px`}
      height={`${props.size + 8}px`}
      pressedOpacity={1}
      releasedButtonStyle={['bg-white']}
      pressedButtonStyle={['rounded-full', 'bg-quaternary']}
    >
      <RightArrow fill={props.color} width={props.size} height={props.size} />
    </BasisButton>
  );
};

export default RightArrowButton;

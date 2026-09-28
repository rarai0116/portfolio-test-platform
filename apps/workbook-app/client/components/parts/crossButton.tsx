import BasisButton from '../identities/button';
import CrossIcon from '../../assets/svg/cross_cancel.svg';

export type CrossButtonProps = {
  readonly outsidewidth?: string;
  readonly outsideHeight?: string;
  readonly color?: string;
  readonly crossSize?: string;
  readonly releasedButtonStyle?: string[];
  readonly pressedButtonStyle?: string[];
  readonly disabledButtonStyle?: string[];
};

const CrossButton = (props: CrossButtonProps) => {
  return (
    <BasisButton
      width={props.outsidewidth ?? props.crossSize}
      height={props.outsideHeight ?? props.crossSize}
      releasedButtonStyle={props.releasedButtonStyle}
      pressedButtonStyle={props.pressedButtonStyle}
      disabledButtonStyle={props.disabledButtonStyle}
      pressedOpacity={1}
    >
      <CrossIcon
        fill={props.color}
        width={props.crossSize}
        height={props.crossSize}
      />
    </BasisButton>
  );
};

export default CrossButton;

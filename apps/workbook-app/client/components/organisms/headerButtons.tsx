import LeftArrow from '../../assets/svg/left-arrow.svg';
import RightArrow from '../../assets/svg/right-arrow.svg';
import FolderIcon from '../../assets/svg/folder_saved-condition-button.svg';
import {
  type ButtonStateType,
  ButtonContextProvider,
} from '../hooks/useButtonContext';
import BasisButton from '../identities/button';
import HouseIcon from '../../assets/svg/house_common.svg';
import CrossIcon from '../../assets/svg/cross_cancel.svg';
import CalculatorActiveIcon from '../../assets/svg/calculator_button_active.svg';
import CalculatorInActiveIcon from '../../assets/svg/calculator_button_inactive.svg';

export type ButtonProps = {
  readonly onPressOut?: () => void;
  readonly buttonState?: ButtonStateType;
  readonly color?: string;
};

export const LeftArrowHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px">
        <LeftArrow width={24} height={24} fill={props.color ?? '#ffffff'} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

export const RightArrowHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px">
        <RightArrow width={24} height={24} fill={props.color ?? '#ffffff'} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

// フォルダボタン
export const FolderHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px" pressedOpacity={1}>
        <FolderIcon width={24} height={24} fill={props.color} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

// バツボタン
export const CrossHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px" pressedOpacity={1}>
        <CrossIcon width={16} height={16} fill={props.color} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

// 電卓ボタン（アクティブ）
export const CalculatorActiveHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px" pressedOpacity={1}>
        <CalculatorActiveIcon width={24} height={24} fill={props.color} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

// 電卓ボタン（インアクティブ）
export const CalculatorInactiveHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px" pressedOpacity={1}>
        <CalculatorInActiveIcon width={24} height={24} fill={props.color} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

// ホームボタン
export const HomeHeaderButton = (props: ButtonProps) => {
  return (
    <ButtonContextProvider
      state={props.buttonState}
      onPressOut={props.onPressOut}
    >
      <BasisButton width="24px" height="24px" pressedOpacity={1}>
        <HouseIcon width={24} height={24} fill={props.color} />
      </BasisButton>
    </ButtonContextProvider>
  );
};

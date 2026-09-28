import {createContext, useState, useMemo, useEffect, useContext} from 'react';
import type {ReactNode} from 'react';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';

/* EnumはTypeScriptだと非推奨なのでユニオン型を使う
https://engineering.linecorp.com/ja/blog/typescript-enum-tree-shaking/
*/
export const ButtonStates = {
  released: 'Released',
  pressed: 'Pressed',
  disabled: 'Disabled',
} as const;
export type ButtonStateType = (typeof ButtonStates)[keyof typeof ButtonStates]; // released|pressed|disabled

export type ButtonStyle = {
  common?: string[];
  released?: string[];
  pressed?: string[];
  disabled?: string[];
};

// ボタンの状態を管理するための汎用カスタムフック
type ButtonContextObject = {
  buttonState: ButtonStateType;
  setButtonState: (state: ButtonStateType) => void;
  onPressIn: () => void;
  onPressOut: () => void;
};

type Props = {
  readonly children: ReactNode;
  readonly onPressIn?: () => void | Promise<void>;
  readonly onPressOut?: () => void | Promise<void>;
  readonly state?: ButtonStateType;
};
export const ButtonContext = createContext<ButtonContextObject>(
  {} as ButtonContextObject,
);
export const ButtonContextProvider = (props: Props) => {
  /* const state: ButtonStateType = useMemo(
		() => props.state ?? ButtonStates.released,
		[props.state],
	);
	*/
  const {isDisabledInput} = useContext(GlobalUserSettingContext);
  const [buttonState, setButtonState] = useState<ButtonStateType>(
    ButtonStates.released,
  );

  const onPressIn = useMemo(
    () => (!isDisabledInput && props.onPressIn ? props.onPressIn : () => {}),
    [props.onPressIn, isDisabledInput],
  );
  const onPressOut = useMemo(
    () => (!isDisabledInput && props.onPressOut ? props.onPressOut : () => {}),
    [props.onPressOut, isDisabledInput],
  );
  const value = useMemo(() => {
    return {
      buttonState,
      setButtonState,
      onPressIn,
      onPressOut,
    };
  }, [buttonState, onPressIn, onPressOut]);

  useEffect(() => {
    // if (props.state === undefined) return;
    // console.log('state changed:', props.state);
    setButtonState(() => props.state ?? ButtonStates.released);
  }, [props.state]);

  return (
    <ButtonContext.Provider value={value}>
      {props.children}
    </ButtonContext.Provider>
  );
};

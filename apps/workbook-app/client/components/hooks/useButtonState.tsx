import {useCallback, useReducer, useContext, useRef} from 'react';
import {ButtonStates, ButtonContext} from './useButtonContext';
import type {ButtonStateType, ButtonStyle} from './useButtonContext';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';
/*
戻り値に型をつけないとエラーがでるので型指定した
https://zenn.dev/gamin/articles/0ce6d637b808b1 
*/
export const useButtonState = (
  optionStyles?: ButtonStyle,
  _state = ButtonStates.released,
): [
  ButtonStateType,
  string[],
  React.Dispatch<ButtonStateType>,
  (fn: () => void) => void,
  (fn: () => void | Promise<void>) => Promise<void>,
  (state: ButtonStateType) => void,
  () => void,
] => {
  // 引数でスタイルが指定されていない場合は初期値で設定する
  const styles: ButtonStyle = {
    common: [],
    released: [],
    pressed: [],
    disabled: [],
    ...optionStyles,
  };
  // useContext(ボタンの状態管理)
  const {buttonState, setButtonState, onPressIn, onPressOut} =
    useContext(ButtonContext);
  const {isDisabledInput} = useContext(GlobalUserSettingContext);

  // 二重起動防止用のフラグ
  const isProcessing = useRef(false);

  // タッチ開始時の処理
  const handlePressIn = useCallback(
    async (fn: () => void | Promise<void> | undefined) => {
      if (isDisabledInput) return;
      if (isProcessing.current) return;
      if (buttonState === ButtonStates.released) {
        setButtonState(ButtonStates.pressed);
        try {
          if (fn) {
            // fn()の戻り値がPromiseかどうかに関わらずawaitできる
            await Promise.resolve(fn());
          }

          if (onPressIn) {
            const wrappedOnPressOut = async () => {
              onPressIn();
            };

            await Promise.resolve(wrappedOnPressOut());
          }
        } finally {
          // setButtonState(ButtonStates.released);
          isProcessing.current = false;
        }
      }
    },
    [buttonState, setButtonState, onPressIn, isDisabledInput],
  );

  // タッチ終了時の処理
  const handlePressOut = useCallback(
    async (fn: () => void | Promise<void> | undefined) => {
      if (isDisabledInput) return;
      if (isProcessing.current) return;
      if (buttonState === ButtonStates.disabled) return;

      isProcessing.current = true;
      setButtonState(ButtonStates.disabled);
      try {
        if (fn) {
          // fn()の戻り値がPromiseかどうかに関わらずawaitできる
          await Promise.resolve(fn());
        }

        if (onPressOut) {
          const wrappedOnPressOut = async () => {
            onPressOut();
          };

          await Promise.resolve(wrappedOnPressOut());
        }
      } finally {
        setButtonState(ButtonStates.released);
        isProcessing.current = false;
      }
    },
    [setButtonState, onPressOut, isDisabledInput, buttonState],
  );
  const handleAllPressOut = useCallback(() => {
    setButtonState(ButtonStates.released);
  }, [setButtonState]);
  // useReducer(ボタンスタイルの管理)
  const reducer = (_styleState: string[], action: ButtonStateType) => {
    return styles.common!.concat(
      (() => {
        switch (action) {
          case ButtonStates.pressed: {
            return styles.pressed;
          }

          case ButtonStates.released: {
            return styles.released;
          }

          case ButtonStates.disabled: {
            return styles.disabled;
          }
        }
      })()!,
    );
  };

  const [buttonStyle, buttonStyleDispatch] = useReducer(
    reducer,
    styles.common!.concat(styles.released!),
  );
  /*
  useEffect(() => {
    console.log('buttonState', buttonState);
    console.log('buttonStyle', buttonStyle);
  }, [buttonState, buttonStyle]);
  */

  return [
    buttonState,
    buttonStyle,
    buttonStyleDispatch,
    handlePressIn,
    handlePressOut,
    setButtonState,
    handleAllPressOut,
  ];
};

import {useCallback, useContext, useMemo, useRef, useState} from 'react';
import {CheckButtonContext, CheckButtonStates} from './useCheckButtonContext';
import type {CheckButtonStateType} from './useCheckButtonContext';

export type StyleStateType = {
  outline: string[]; // チェックマークの外側
  checkMark: string[] | {fill: string}; // チェックマーク
  text: string[];
};

export type CheckButtonStyle = {
  common?: string[];
  unchecked?: StyleStateType;
  checked?: StyleStateType;
  disabled?: StyleStateType;
  disabledChecked?: StyleStateType;
};

export const useCheckButtonState = (
  optionStyles: CheckButtonStyle,
  id: string,
  state: CheckButtonStateType = CheckButtonStates.unchecked,
  onActivateFromProps?: () => void,
  onDeactivateFromProps?: () => void,
): {
  checkButtonState: CheckButtonStateType;
  checkButtonStyle: {
    outline: string[];
    checkMark: string[] | {fill: string};
    text: string[];
  };
  onPressCheckButton: () => void;
} => {
  // 引数でスタイルが指定されていない場合は初期値で設定する
  const styles: CheckButtonStyle = useMemo(() => {
    return {
      common: [],
      unchecked: {outline: [], checkMark: [], text: []},
      checked: {outline: [], checkMark: [], text: []},
      disabled: {outline: [], checkMark: [], text: []},
      disabledChecked: {outline: [], checkMark: [], text: []},
      ...optionStyles,
    };
  }, [optionStyles]);
  // useReducer(ボタンスタイルの管理)
  /*
  const initialStyleState: StyleStateType = useMemo(() => {
    return {
      outline: styles.common!.concat(styles.unchecked!.outline),
      checkMark: styles.unchecked!.checkMark,
      text: styles.unchecked!.text,
    };
  }, [styles]);
  */

  const stateRef = useRef<CheckButtonStateType>(state);
  const [_isCallActivateEffect, _setIsCallActivateEffect] =
    useState<boolean>(false);
  const [_isCallDeactivateEffect, _setIsCallDeactivateEffect] =
    useState<boolean>(false);

  // useContext(ボタンの状態管理)
  const {
    onActivateEffect: _onActivateEffect,
    onDeactivateEffect: _onDeactivateEffect,
  } = useContext(CheckButtonContext);
  const {disabledButtonIdList, checkedButtonIdList, toggleCheckedButton} =
    useContext(CheckButtonContext);
  /*  const [checkButtonState, setCheckButtonState] =
    useState<CheckButtonStateType>(state);
    */
  // アクティブ時
  const onActivate = useCallback(() => {
    const fn = onActivateFromProps;

    if (fn) fn();
    // if (onActivateEffect) onActivateEffect(id);
  }, [onActivateFromProps]);
  // 非アクティブ時
  const onDeactivate = useCallback(() => {
    const fn = onDeactivateFromProps;
    if (fn) fn();
    // if (onDeactivateEffect) onDeactivateEffect();
  }, [onDeactivateFromProps]);

  const {checkButtonState, checkButtonStyle} = useMemo(() => {
    const checkButtonState = (() => {
      if (checkedButtonIdList.includes(id)) {
        return disabledButtonIdList.includes(id)
          ? CheckButtonStates.disabledChecked
          : CheckButtonStates.checked;
      } else {
        return disabledButtonIdList.includes(id)
          ? CheckButtonStates.disabled
          : CheckButtonStates.unchecked;
      }
    })();
    const checkButtonStyle = (() => {
      switch (checkButtonState) {
        case CheckButtonStates.unchecked: {
          return {
            outline: styles.common!.concat(styles.unchecked!.outline),
            checkMark: styles.unchecked!.checkMark,
            text: styles.unchecked!.text,
          };
        }

        case CheckButtonStates.checked: {
          return {
            outline: styles.common!.concat(styles.checked!.outline),
            checkMark: styles.checked!.checkMark,
            text: styles.checked!.text,
          };
        }

        case CheckButtonStates.disabled: {
          return {
            outline: styles.common!.concat(styles.disabled!.outline),
            checkMark: styles.disabled!.checkMark,
            text: styles.disabled!.text,
          };
        }

        case CheckButtonStates.disabledChecked: {
          return {
            outline: styles.common!.concat(styles.disabledChecked!.outline),
            checkMark: styles.disabledChecked!.checkMark,
            text: styles.disabledChecked!.text,
          };
        }
      }
    })();
    if (
      stateRef.current === CheckButtonStates.unchecked &&
      checkButtonState === CheckButtonStates.checked
    ) {
      onActivate();
      // setIsCallActivateEffect(true);
    }

    if (
      stateRef.current === CheckButtonStates.checked &&
      checkButtonState === CheckButtonStates.unchecked
    ) {
      onDeactivate();
      // setIsCallDeactivateEffect(true);
    }

    stateRef.current = checkButtonState;
    return {checkButtonState, checkButtonStyle};
  }, [
    styles,
    id,
    checkedButtonIdList,
    disabledButtonIdList,
    onActivate,
    onDeactivate,
  ]);
  const onPressCheckButton = useCallback(() => {
    if (checkButtonState === 'Checked' || checkButtonState === 'Unchecked')
      toggleCheckedButton(id);
  }, [checkButtonState, id, toggleCheckedButton]);

  /*
  useEffect(() => {
    //    console.log('useEffect: checkButtonState changed', checkButtonState);
    // スタイルの更新が必要な場合はここで行う
    if (checkButtonState === CheckButtonStates.checked && onActivateEffect)
      onActivateEffect(id);

    setIsCallActivateEffect(false);
  }, [isCallActivateEffect]);
  */
  /*
  useEffect(() => {
    //    console.log('useEffect: checkButtonState changed', checkButtonState);
    // スタイルの更新が必要な場合はここで行う
    if (checkButtonState === CheckButtonStates.unchecked && onDeactivateEffect)
      onDeactivateEffect();
    setIsCallDeactivateEffect(false);
  }, [isCallDeactivateEffect]);
  */

  return {
    checkButtonState,
    checkButtonStyle,
    onPressCheckButton,
  };
};

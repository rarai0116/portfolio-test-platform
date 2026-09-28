import {createContext, useState, useMemo, useCallback} from 'react';
import type {ReactNode} from 'react';
import {removeArrayElement} from '@functionals/arrayManager';

export const CheckButtonStates = {
  unchecked: 'Unchecked',
  checked: 'Checked',
  disabled: 'Disabled',
  disabledChecked: 'DisabledChecked',
} as const;

export type CheckButtonStateType =
  (typeof CheckButtonStates)[keyof typeof CheckButtonStates]; // 'Checked','Unchecked','Disabled'

/* import {CheckButtonStates} from './useCheckButtonState'; */

// ボタンの状態を管理するための汎用カスタムフック
export type ButtonInfo = {
  id: string;
  name: string;
  initialState: CheckButtonStateType;
  level?: string; // 階層
  value?: string | number; // ボタンの値
  parentName?: string;
};
export type ButtonInfoList = ButtonInfo[];
type CheckButtonContextObject = {
  /*
  toggleTargetButtonList: ButtonInfoList;
  setToggleTargetButtonList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  addToggleTargetButtonList: (buttonInfo: ButtonInfo) => void;
  */
  // removeToggleTargetButtonList: (buttonInfo: ButtonInfo) => void;
  //  toggleTargetButtonIdList: string[];
  checkedButtonList: ButtonInfoList;
  setCheckedButtonList: (newCheckedButtonList: ButtonInfoList) => void;
  addCheckedButtonList: (buttonInfo: ButtonInfo) => void;
  // removeCheckedButtonList: (buttonInfo: ButtonInfo) => void;
  disabledButtonInfoList: ButtonInfoList;
  /*
  setDisabledButtonInfoList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  */
  checkedButtonIdList: string[];
  disabledButtonIdList: string[];
  buttonInfoList: ButtonInfoList;
  onActivateEffect: (id?: string) => void;
  onDeactivateEffect: () => void;
  buttonInfoDictionary: Record<string, ButtonInfo>;
  buttonInfoIdList: string[];
  toggleCheckedButton: (
    buttonId: string,
    callBack?: (buttonId: string) => string[],
  ) => void;
};

type Props = {
  readonly children: ReactNode;
  readonly buttonInfoList: ButtonInfoList;
  readonly checkedButtonList: ButtonInfoList;
  readonly setCheckedButtonList: React.Dispatch<
    React.SetStateAction<ButtonInfoList>
  >;
  readonly onActivateEffect?: (id?: string) => void;
  readonly onDeactivateEffect?: () => void;
  readonly toggleCallback?: (
    targetButtonIdList: string[],
    currentcheckedButtonIdList: string[],
    buttonIdList: string[],
    buttonInfoList: ButtonInfoList,
  ) => string[];
};

export const CheckButtonContext = createContext<CheckButtonContextObject>(
  {} as CheckButtonContextObject,
);

/**
 * @module useCheckedButtonList
 * @desc チェックボタンのチェック状況をButtonInfoListから生成する
 * @param {ButtonInfoList} 初期ボタンリスト(必ずCheckButtonContextProviderと同じものを指定する)
 * @returns {ButtonInfoList} checkedButtonList
 * @returns {React.Dispatch<React.SetStateAction<ButtonInfoList>>} setCheckedButtonList
 */
export const useCheckedButtonList: (
  buttonInfoList: ButtonInfoList,
) => [ButtonInfoList, React.Dispatch<React.SetStateAction<ButtonInfoList>>] = (
  buttonInfoList,
) => {
  const [checkedButtonList, setCheckedButtonList] = useState<ButtonInfoList>(
    buttonInfoList.filter(
      (button) =>
        button.initialState === CheckButtonStates.checked ||
        button.initialState === CheckButtonStates.disabledChecked,
    ),
  );
  return [checkedButtonList, setCheckedButtonList];
};

/**
 * @module CheckButtonContextProvider
 * @desc チェックボタンの状態管理用コンテキストのプロバイダー
 * @param {buttonInfoList} ボタンリスト(必ずuseCheckedButtonListと同じものを指定する)
 * @param {checkedButtonList} チェックしたボタンのリスト(useCheckedButtonListで生成)
 * @param {setCheckedButtonList} チェックしたボタンのリストの更新関数(useCheckedButtonListで生成)
 * @param {onActivateEffect} チェックしたボタンがチェックされたときの処理(任意)
 * @param {onDeactivateEffect} チェックしたボタンがチェック解除されたときの処理(任意)
 * @example import {CheckButtonContextProvider,useCheckedButtonList} from '../hooks/useCheckButtonContext';
 * @example ~~~
 * @example const [checkedButtonList, setCheckedButtonList] = useCheckedButtonList(buttonInfoList);
 * @example ~~~
 * @example return (
 * @example 	<CheckButtonContextProvider
 * @example 		buttonInfoList={buttonInfoList}
 * @example 		checkedButtonList={checkedButtonList}
 * @example 		setCheckedButtonList={setCheckedButtonList}
 * @example 	>
 * @example 		<DataPart />
 * @example 	</CheckButtonContextProvider>
 * @example );
 */
export const CheckButtonContextProvider = (props: Props) => {
  // チェックしたボタンのリスト
  const [checkedButtonList, setCheckedButtonList] = useMemo(
    () => [props.checkedButtonList, props.setCheckedButtonList],
    [props.checkedButtonList, props.setCheckedButtonList],
  );

  // 選択不可のボタンリスト
  // console.log(props.buttonInfoList);
  const disabledButtonInfoList = useMemo(
    () =>
      props.buttonInfoList.filter(
        (button) =>
          button.initialState === CheckButtonStates.disabled ||
          button.initialState === CheckButtonStates.disabledChecked,
      ),
    [props.buttonInfoList],
  );
  const buttonInfoList = useMemo(
    () => props.buttonInfoList,
    [props.buttonInfoList],
  );
  // buttonInfoListをidをキーにして辞書型に変換
  const buttonInfoDictionary: Record<string, ButtonInfo> = useMemo(() => {
    return buttonInfoList.reduce<Record<string, ButtonInfo>>(
      (acc, buttonInfo) => {
        acc[buttonInfo.id] = buttonInfo;
        return acc;
      },
      {},
    );
  }, [buttonInfoList]);
  // buttonInfoListのidキーリスト
  const buttonInfoIdList = useMemo(
    () => Object.keys(buttonInfoDictionary),
    [buttonInfoDictionary],
  );

  const checkedButtonIdList = useMemo(
    () => checkedButtonList.map((button) => button.id),
    [checkedButtonList],
  );
  const setCheckedButtonIdList = useCallback(
    (newCheckedButtonIdList: string[]) => {
      const newCheckedButtonList = newCheckedButtonIdList.map((buttonId) => {
        return buttonInfoDictionary[buttonId];
      });
      setCheckedButtonList(newCheckedButtonList);
    },
    [setCheckedButtonList, buttonInfoDictionary],
  );
  const addCheckedButtonList = useCallback(
    (buttonInfo: ButtonInfo) => {
      setCheckedButtonList([...checkedButtonList, buttonInfo]);
    },
    [setCheckedButtonList, checkedButtonList],
  );

  const disabledButtonIdList = useMemo(
    () => disabledButtonInfoList.map((button) => button.id),
    [disabledButtonInfoList],
  );

  const onActivateEffect = useMemo(
    () => props.onActivateEffect ?? (() => {}),
    [props.onActivateEffect],
  );
  const onDeactivateEffect = useMemo(
    () => props.onDeactivateEffect ?? (() => {}),
    [props.onDeactivateEffect],
  );

  // チェックボタンひとつの状態を変更する。条件によって他のチェック状態も更新する場合はcallBackを指定する
  const toggleCheckedButton = useCallback(
    (buttonId: string) => {
      if (disabledButtonIdList.includes(buttonId)) {
        // Disabled状態のボタンの場合、何もしない
        return;
      }

      void [checkedButtonIdList.includes(buttonId)];

      if (props.toggleCallback) {
        const newButtonIdList = props.toggleCallback(
          [buttonId],
          checkedButtonIdList,
          buttonInfoIdList,
          buttonInfoList,
        );

        setCheckedButtonIdList(newButtonIdList);
      } else if (checkedButtonIdList.includes(buttonId)) {
        // チェックを外す
        setCheckedButtonIdList(
          removeArrayElement(buttonId, checkedButtonIdList),
        );
      } else {
        // チェックする
        setCheckedButtonIdList([...checkedButtonIdList, buttonId]);
      }
    },
    [
      checkedButtonIdList,
      setCheckedButtonIdList,
      disabledButtonIdList,
      buttonInfoIdList,
      buttonInfoList,
      props,
    ],
  );

  const value = useMemo(() => {
    return {
      //      toggleTargetButtonList,
      //      setToggleTargetButtonList,
      //      addToggleTargetButtonList,
      // removeToggleTargetButtonList,
      //      toggleTargetButtonIdList,
      checkedButtonList,
      setCheckedButtonList,
      addCheckedButtonList,
      // removeCheckedButtonList,
      disabledButtonInfoList,
      //      setDisabledButtonInfoList,
      checkedButtonIdList,
      buttonInfoList,
      disabledButtonIdList,
      onActivateEffect,
      onDeactivateEffect,
      buttonInfoDictionary,
      buttonInfoIdList,
      toggleCheckedButton,
    };
  }, [
    //    toggleTargetButtonList,
    //    setToggleTargetButtonList,
    //    addToggleTargetButtonList,
    // removeToggleTargetButtonList,
    //    toggleTargetButtonIdList,
    checkedButtonList,
    setCheckedButtonList,
    addCheckedButtonList,
    // removeCheckedButtonList,
    disabledButtonInfoList,
    //    setDisabledButtonInfoList,
    checkedButtonIdList,
    disabledButtonIdList,
    buttonInfoList,
    onActivateEffect,
    onDeactivateEffect,
    buttonInfoDictionary,
    buttonInfoIdList,
    toggleCheckedButton,
  ]);

  return (
    <CheckButtonContext.Provider value={value}>
      {props.children}
    </CheckButtonContext.Provider>
  );
};

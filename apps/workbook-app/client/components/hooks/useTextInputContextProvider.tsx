import {createContext, useMemo, useState, useRef} from 'react';
import type {ReactNode} from 'react';
// import {type TextInput} from 'react-native';
import type {TextInput} from 'react-native-gesture-handler';

type TextInputContextObject = {
  textInputRef: React.MutableRefObject<TextInput | null>;
  isFocusTextInput: boolean;
  setIsFocusTextInput: React.Dispatch<React.SetStateAction<boolean>>;
  focusTextInputId: string | undefined;
  setFocusTextInputId: React.Dispatch<React.SetStateAction<string | undefined>>;
  isPreviousFocus: boolean;
  setIsPreviousFocus: React.Dispatch<React.SetStateAction<boolean>>;
  textValue: string | undefined;
  setTextValue: React.Dispatch<React.SetStateAction<string | undefined>>;
  textLength: number;
  setTextLength: React.Dispatch<React.SetStateAction<number>>;
};

type Props = {
  readonly children: ReactNode;
};

export const TextInputContext = createContext<TextInputContextObject>(
  {} as TextInputContextObject,
);

export const TextInputContextProvider = (props: Props) => {
  const textInputRef = useRef<TextInput | null>(null);
  const [isFocusTextInput, setIsFocusTextInput] = useState<boolean>(false);
  const [focusTextInputId, setFocusTextInputId] = useState<string | undefined>(
    undefined,
  );
  const [isPreviousFocus, setIsPreviousFocus] = useState<boolean>(false);

  const [textValue, setTextValue] = useState<string | undefined>(undefined);
  const [textLength, setTextLength] = useState<number>(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      textInputRef,
      isFocusTextInput,
      setIsFocusTextInput,
      focusTextInputId,
      setFocusTextInputId,
      isPreviousFocus,
      setIsPreviousFocus,
      textValue,
      setTextValue,
      textLength,
      setTextLength,
    };
  }, [
    textInputRef,
    isFocusTextInput,
    setIsFocusTextInput,
    focusTextInputId,
    setFocusTextInputId,
    isPreviousFocus,
    setIsPreviousFocus,
    textValue,
    setTextValue,
    textLength,
    setTextLength,
  ]);

  return (
    <TextInputContext.Provider value={value}>
      {props.children}
    </TextInputContext.Provider>
  );
};

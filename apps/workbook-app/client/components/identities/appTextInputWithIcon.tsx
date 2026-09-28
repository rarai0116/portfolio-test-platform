import {View, TextInput, Keyboard} from 'react-native';
import {type ReactNode, useState, useContext, useRef, useEffect} from 'react';
import tw from '../../tailwind.custom';
import Spacer from '../parts/spacer';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import BasisButton from './button';
import AppText from './appText';

/** maxLength: 半角 */
export type AppTextInputWithIconProps = {
  readonly inputStyle: string;
  readonly placeholder?: string;
  readonly placeholderTextColor?: string;
  readonly focusStyle?: {outlineColor?: string};
  readonly maxLength: number;
  readonly isAutoFocus?: boolean;
  readonly defaultValue?: string;
  readonly icon: ReactNode;
  readonly id?: string;
};

const AppTextInputWithIcon = (properties: AppTextInputWithIconProps) => {
  // 初期値
  const {
    inputStyle,
    placeholder = '',
    placeholderTextColor = '#BABABA',
    focusStyle = {outlineColor: '#289DF4'},
    maxLength,
  } = properties;

  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [textLength, setTextLength] = useState<number>(0);

  const {setTextValue} = useContext(TextInputContext);

  const textInputReference = useRef<TextInput | null>(null);

  const [isShowkeyboard, setisShowkeyboard] = useState<boolean>(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setisShowkeyboard(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setisShowkeyboard(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={tw`w-full flex-row`}>
      <TextInput
        ref={textInputReference}
        id={properties.id}
        textAlignVertical="top"
        allowFontScaling={false}
        style={tw.style(inputStyle, isFocused && focusStyle)} // workbookblue-500
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        maxLength={maxLength}
        autoFocus={properties.isAutoFocus ?? false}
        defaultValue={properties.defaultValue}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
        }}
        onSubmitEditing={(_event) => {}}
        onChangeText={(newText) => {
          let length = 0;
          for (const element of newText) {
            if (/[ -~]/.test(element)) {
              // console.log('半角');
              // newText[i].match(/[ -~]/)
              length += 0.5;
            } else {
              // console.log('全角');
              length++;
            }
          }

          setTextValue(newText);

          setTextLength(length);
        }}
      />
      <Spacer isHorizontal={false} size={4} />

      {!isShowkeyboard && (
        <View style={tw`flex-row pt-0.5`}>
          <Spacer isHorizontal size={8} />
          <ButtonContextProvider
            state={ButtonStates.released}
            onPressOut={() => {
              if (textInputReference.current !== null) {
                textInputReference.current.focus();
              }
            }}
          >
            <BasisButton width="14px" height="14px" pressedOpacity={1}>
              {properties.icon}
            </BasisButton>
          </ButtonContextProvider>
        </View>
      )}

      {isShowkeyboard && (
        <>
          <Spacer isHorizontal size={8} />
          <View style={tw`absolute right-4 pt-0.5`}>
            <AppText style={tw`text-xs text-secondary`}>
              {textLength}/{maxLength / 2}
            </AppText>
          </View>
        </>
      )}
    </View>
  );
};

export default AppTextInputWithIcon;

import {View, Keyboard} from 'react-native';
import {useContext, useEffect, useMemo} from 'react';
import type {KeyboardTypeOptions, TextInputProps} from 'react-native';
import {TextInput as GestureTextInput} from 'react-native-gesture-handler';
import {forwardRef} from 'react';
import tw from '../../tailwind.custom';
import Spacer from '../parts/spacer';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import AppText from './appText';
/** maxLength: 半角 */
export type AppTextInputProps = {
  readonly inputStyle: string;
  readonly height?: number;
  readonly maxLength: number;
  readonly isShowWordCount: boolean;
  readonly placeholder?: string;
  readonly placeholderTextColor?: string;
  readonly focusStyle?: string;
  readonly hasMultiline?: boolean;
  readonly isAutoFocus?: boolean;
  readonly defaultValue?: string;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly textAlignVertical?: 'top' | 'auto' | 'bottom' | 'center' | undefined; // Android only
  readonly onBlur?: () => void;
  readonly onFocus?: () => void;
  readonly onChangeText?: (text: string) => void;
  readonly id: string;
  readonly isFixHeight?: boolean;
};

const ForwardedTextInput = forwardRef<GestureTextInput, TextInputProps>(
  (props, ref) => {
    return <GestureTextInput ref={ref} {...props} />;
  },
);

const AppTextInput = (props: AppTextInputProps) => {
  // 初期値
  const {
    inputStyle,
    height,
    placeholder = '',
    placeholderTextColor = '#BABABA',
    focusStyle = 'border-workbookblue-500',
    hasMultiline = false,
    maxLength,
    keyboardType = 'default',
    textAlignVertical = 'top',
  } = props;

  const {
    textInputRef,
    isFocusTextInput,
    setIsFocusTextInput,
    setFocusTextInputId,
    setIsPreviousFocus,
    textValue,
    setTextValue,
    textLength,
    setTextLength,
  } = useContext(TextInputContext);

  const modifiedDefaultValueLength = useMemo(() => {
    let length = 0;
    if (props.defaultValue) {
      for (const element of props.defaultValue) {
        if (/[ -~]/.test(element)) {
          // console.log('半角');
          // newText[i].match(/[ -~]/)
          length += 0.5;
        } else {
          // console.log('全角');
          length++;
        }
      }
    }

    return length;
  }, [props.defaultValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (props.defaultValue) {
      setTextLength(modifiedDefaultValueLength);
      setTextValue(props.defaultValue);
    }

    // console.log(props.defaultValue?.length, maxLength);
  }, [props.defaultValue]);

  return (
    <>
      <ForwardedTextInput
        ref={textInputRef}
        value={textValue}
        keyboardType={keyboardType}
        textAlignVertical={textAlignVertical}
        multiline={hasMultiline}
        placeholderTextColor={placeholderTextColor}
        maxLength={maxLength}
        allowFontScaling={false}
        autoFocus={props.isAutoFocus ?? false}
        defaultValue={props.defaultValue}
        style={tw.style(
          inputStyle,
          isFocusTextInput && focusStyle,
          `min-h-[${height}px]`,
          props.isFixHeight && `h-[${height}px]`,
        )}
        placeholder={placeholder}
        onFocus={() => {
          setIsFocusTextInput(true);
          setFocusTextInputId(props.id);

          if (props.onFocus) props.onFocus();
          // console.log('onFocus');
        }}
        onBlur={() => {
          // Keyboard.dismiss();
          setIsFocusTextInput(false);
          setFocusTextInputId('');
          setIsPreviousFocus(true);
          if (props.onBlur) props.onBlur();
          // console.log('onBlur');
        }}
        onSubmitEditing={(_event) => {
          Keyboard.dismiss();
          // console.log('onSubmitEditing', event.nativeEvent.text);
        }}
        onChangeText={(newText) => {
          let length = 0;

          for (const element of newText) {
            if (/[ -~]/.test(element)) {
              // console.log('半角');

              // newText[i].match(/[ -~]/)
              length += 0.5;
              // length++;
            } else {
              // console.log('全角');
              length++;
              // length += 2;
            }

            if (length > maxLength / 2) {
              // console.log('maxLength');
              return;
            }
          }

          // console.log('maxLength', maxLength, maxLength / 2);
          // console.log('length', length);
          setTextValue(newText);
          // console.log('newText', newText);
          setTextLength(length);
          if (props.onChangeText) props.onChangeText(newText);
        }}
      />
      <Spacer isHorizontal={false} size={4} />

      {props.isShowWordCount ? (
        <View style={tw`items-end `}>
          <AppText style={tw`text-xs text-secondary`}>
            {textLength}/{maxLength / 2}
          </AppText>
        </View>
      ) : null}
    </>
  );
};

export default AppTextInput;

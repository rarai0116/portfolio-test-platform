import {View} from 'react-native';
import {useMemo, memo} from 'react';
import type {ReactNode} from 'react';
import {Pressable} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import type {CheckButtonStyle} from '../hooks/useCheckButtonState';
import {useCheckButtonState} from '../hooks/useCheckButtonState';
import {CheckButtonStates} from '../hooks/useCheckButtonContext';
import CheckMark from '../../assets/svg/check_checkbox.svg';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import AppText from './appText';

export type CheckBoxProps = {
  readonly activeOpacity?: number;
  readonly uncheckedButtonStyle?: {
    outline: string[];
    checkMark: string[] | {fill: string};
    text: string[];
  };
  readonly checkedButtonStyle?: {
    outline: string[];
    checkMark: string[] | {fill: string};
    text: string[];
  };
  readonly disabledButtonStyle?: {
    outline: string[];
    checkMark: string[] | {fill: string};
    text: string[];
  };
  readonly disabledCheckedButtonStyle?: {
    outline: string[];
    checkMark: string[] | {fill: string};
    text: string[];
  };
  readonly info: ButtonInfo;
  readonly id?: string;
  readonly name?: string;
  readonly checkBoxStyle?: string;
  readonly children?: ReactNode;
  readonly onActivateFromProps?: () => void;
  readonly onDeactivateFromProps?: () => void;
};

const CheckBox = memo((props: CheckBoxProps) => {
  // 初期値
  const {
    activeOpacity = 1,
    uncheckedButtonStyle = {
      outline: ['border-workbookblue-500', 'bg-white'],
      checkMark: {fill: '#ffffff'}, // fill-white
      text: ['text-base', 'text-primary'],
    },
    checkedButtonStyle = {
      outline: ['border-workbookblue-500', 'bg-workbookblue-500'],
      checkMark: {fill: '#ffffff'}, // fill-white
      text: ['text-base', 'text-primary'],
    },
    disabledButtonStyle = {
      outline: ['border-tertiary', 'bg-quaternary'],
      checkMark: {fill: '#ECECEC'}, // fill-quaternary
      text: ['text-base', 'text-tertiary'],
    },
    disabledCheckedButtonStyle = {
      outline: ['border-workbookblue-200', 'bg-workbookblue-200'],
      checkMark: {fill: '#ffffff'}, // fill-white
      text: ['text-base', 'text-primary'],
    },
    info = /* buttonInfo */ {
      id: '0',
      name: '初期値',
      initialState: CheckButtonStates.unchecked,
      parentName: '',
    },
    id = info.id,
    name = info.name,
    checkBoxStyle = 'ml-4',
  } = props;

  const checkBoxStyleData: CheckButtonStyle = useMemo(() => {
    const commonStyle = [
      'w-5',
      'h-5',
      'justify-center',
      'items-center',
      'rounded',
      'border',
      'mt-0.5',
    ];
    return {
      common: commonStyle,
      unchecked: uncheckedButtonStyle,
      checked: checkedButtonStyle,
      disabled: disabledButtonStyle,
      disabledChecked: disabledCheckedButtonStyle,
    };
  }, [
    uncheckedButtonStyle,
    checkedButtonStyle,
    disabledButtonStyle,
    disabledCheckedButtonStyle,
  ]);

  // ボタンの状態を管理するための汎用カスタムフック
  const {checkButtonStyle, onPressCheckButton} = useCheckButtonState(
    checkBoxStyleData,
    id,
    props.info?.initialState ?? CheckButtonStates.unchecked,
    props.onActivateFromProps,
    props.onDeactivateFromProps,
  );

  return (
    <>
      <Pressable
        style={({pressed}) =>
          tw.style(checkBoxStyle, 'flex-row', {
            opacity: pressed ? activeOpacity : 1,
          })
        }
        onPress={onPressCheckButton}
      >
        <View style={tw.style(checkButtonStyle.outline)}>
          <CheckMark
            width={12}
            height={10}
            style={tw.style(checkButtonStyle.checkMark)}
          />
        </View>
        {name ? (
          <AppText style={tw.style(checkButtonStyle.text, 'w-11/12 ml-2')}>
            {name}
          </AppText>
        ) : null}
      </Pressable>
      {props.children}
    </>
  );
});

export default CheckBox;

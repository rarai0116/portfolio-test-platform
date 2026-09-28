import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import type {ReactNode} from 'react';
import {Pressable} from 'react-native-gesture-handler';
import tw from '../../tailwind.custom';
import type {CheckButtonStyle} from '../hooks/useCheckButtonState';
import {useCheckButtonState} from '../hooks/useCheckButtonState';
import {
  CheckButtonContext,
  CheckButtonStates,
} from '../hooks/useCheckButtonContext';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import AppText from './appText';

export type RadioButtonProps = {
  readonly activeOpacity?: number;
  readonly uncheckedButtonStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly checkedButtonStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly disabledButtonStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly disabledCheckedButtonStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly info?: ButtonInfo;
  readonly id?: string;
  readonly name?: string;
  readonly radioButtonStyle?: string;
  readonly onActivateFromProps?: () => void;
  readonly children?: ReactNode;
};

const RadioButton = (props: RadioButtonProps) => {
  // 初期値
  const marginTop = useMemo(() => {
    return /* Platform.OS === 'ios' ? '' :  */ 'mt-0.5';
  }, []);
  const {
    activeOpacity = 1,
    uncheckedButtonStyle = {
      outline: [`${marginTop}`, 'border-workbookblue-500', 'bg-white'],
      checkMark: [''],
      text: ['text-base', 'text-primary'],
    },
    checkedButtonStyle = {
      outline: [`${marginTop}`, 'border-workbookblue-500', 'bg-white'],
      checkMark: ['w-3', 'h-3', 'rounded-full', 'bg-workbookblue-500'],
      text: ['text-base', 'text-primary'],
    },
    disabledButtonStyle = {
      outline: [`${marginTop}`, 'border-tertiary', 'bg-quaternary'],
      checkMark: [''],
      text: ['text-base', 'text-tertiary'],
    },
    disabledCheckedButtonStyle = {
      outline: [`${marginTop}`, 'border-workbookblue-200', 'bg-white'],
      checkMark: ['w-3', 'h-3', 'rounded-full', 'bg-workbookblue-200'],
      text: ['text-base', 'text-primary'],
    },
    info = {id: '0', name: '初期値', initialState: CheckButtonStates.unchecked},
    id = info.id,
    name = info.name,
    // state = CheckButtonStates.unchecked,
    radioButtonStyle = 'ml-4',
  } = props;

  const radiobuttonStyleData: CheckButtonStyle = useMemo(() => {
    const commonStyle = [
      'w-5',
      'h-5',
      'justify-center',
      'items-center',
      'rounded-full',
      'border',
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

  // console.log(radiobuttonStyleData);

  // ボタンの状態を管理するための汎用カスタムフック
  const {checkButtonStyle} = useCheckButtonState(
    radiobuttonStyleData,
    id,
    props.info?.initialState ?? CheckButtonStates.unchecked,
  );

  // console.log('カスタムフック呼び出し後の状態' + checkButtonState);
  // console.log(checkButtonStyle);

  // 初期化
  /* useEffect(() => {
		console.log('initialize');
		setCheckButtonState(state);
	}, []); */

  // ボタンの状態が変わるごとにスタイルを適用し直す
  /*
  useEffect(() => {
    // console.log('スタイル適用時の状態' + checkButtonState);
    checkButtonStyleDispatch(checkButtonState);
  }, [checkButtonState, checkButtonStyleDispatch]);
  */

  const {
    setCheckedButtonList,
    disabledButtonIdList,
    checkedButtonIdList,
    onActivateEffect,
  } = useContext(CheckButtonContext);

  // ボタンの状態を変更
  /*
  useEffect(() => {
    // console.log('★' + id);
    if (disabledButtonIdList.includes(id)) {
      if (checkedButtonIdList.includes(id))
        setCheckButtonState(CheckButtonStates.disabledChecked);
      else setCheckButtonState(CheckButtonStates.disabled);
    } else if (checkedButtonIdList.length > 0) {
      if (checkedButtonIdList[0] === id) {
        // console.log('ボタンリスト', checkedButtonList);
        console.log(`id:${id}`);

        setCheckButtonState(CheckButtonStates.checked);
      } else {
        setCheckButtonState(CheckButtonStates.unchecked);
      }
    }
  }, [checkedButtonIdList, id, disabledButtonIdList]);
*/
  // console.log('id-' + id + ': ' + checkButtonState);

  return (
    <Pressable
      style={({pressed}) =>
        tw.style(radioButtonStyle, 'flex-row', {
          opacity: pressed ? activeOpacity : 1,
        })
      }
      onPress={() => {
        if (props.onActivateFromProps !== undefined)
          props.onActivateFromProps();
        onActivateEffect(id);
        if (
          !checkedButtonIdList.includes(id) &&
          !disabledButtonIdList.includes(id)
        )
          setCheckedButtonList([info]);
      }}
    >
      <View style={tw.style(checkButtonStyle.outline)}>
        <View style={tw.style(checkButtonStyle.checkMark)} />
      </View>
      {props.children ?? (
        <AppText style={tw.style(checkButtonStyle.text, 'w-11/12 ml-2')}>
          {name}
        </AppText>
      )}
    </Pressable>
  );
};

export default RadioButton;

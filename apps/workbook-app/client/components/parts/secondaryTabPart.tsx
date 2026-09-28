import {Pressable} from 'react-native-gesture-handler';
import {useContext, useMemo} from 'react';
import tw from '../../tailwind.custom';
import type {CheckButtonStyle} from '../hooks/useCheckButtonState';
import {useCheckButtonState} from '../hooks/useCheckButtonState';
import {
  CheckButtonContext,
  CheckButtonStates,
} from '../hooks/useCheckButtonContext';
import type {ButtonInfo} from '../hooks/useCheckButtonContext';
import AppText from '../identities/appText';

export type SecondaryTabPartProps = {
  readonly activeOpacity?: number;
  readonly deselectedTabStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly selectedTabStyle?: {
    outline: string[];
    checkMark: string[];
    text: string[];
  };
  readonly info?: ButtonInfo;
  readonly id?: string;
  readonly name?: string;
  // state?: CheckButtonStateType;
  readonly onActivateFromProps?: () => void;
};

const SecondaryTabPart = (props: SecondaryTabPartProps) => {
  // 初期値
  const {
    activeOpacity = 1,
    deselectedTabStyle = {
      outline: ['border-workbookblue-500', 'bg-white'],
      checkMark: [''],
      text: ['text-sm', 'text-workbookblue-500'],
    },
    selectedTabStyle = {
      outline: ['border-workbookblue-500', 'bg-workbookblue-500'],
      checkMark: [''],
      text: ['text-sm', 'text-white'],
    },
    info = {id: '0', name: '初期値', initialState: CheckButtonStates.unchecked},
    id = info.id,
    name = info.name,
  } = props;

  const secondaryTabPartStyleData: CheckButtonStyle = useMemo(() => {
    const commonStyle = [
      'h-7',
      'px-3',
      'justify-center',
      'items-center',
      'rounded-4',
      'border',
    ];
    return {
      common: commonStyle,
      unchecked: deselectedTabStyle,
      checked: selectedTabStyle,
    };
  }, [deselectedTabStyle, selectedTabStyle]);

  // ボタンの状態を管理するための汎用カスタムフック
  const {checkButtonStyle} = useCheckButtonState(
    secondaryTabPartStyleData,
    id,
    props.info?.initialState ?? CheckButtonStates.unchecked,
  );

  // ボタンの状態が変わるごとにスタイルを適用し直す
  /*
  useEffect(() => {
    checkButtonStyleDispatch(checkButtonState);
  }, [checkButtonState, checkButtonStyleDispatch]);
*/
  const {checkedButtonIdList, disabledButtonIdList, setCheckedButtonList} =
    useContext(CheckButtonContext);

  // ボタンの状態を変更
  /*
  useEffect(() => {
    if (
      checkButtonState !== CheckButtonStates.disabled &&
      checkButtonState !== CheckButtonStates.disabledChecked &&
      checkedButtonList.length > 0
    ) {
      if (checkedButtonList[0].id === id) {
        console.log(`id:${id}`);

        setCheckButtonState(CheckButtonStates.checked);
      } else {
        setCheckButtonState(CheckButtonStates.unchecked);
      }
    }
  }, [checkedButtonList, id, setCheckButtonState, checkButtonState]);
  */

  // console.log('id-' + id + ': ' + checkButtonState);
  return (
    <Pressable
      style={({pressed}) =>
        tw.style(
          checkButtonStyle.outline.concat(
            pressed ? `opacity-${activeOpacity * 100}` : '',
          ),
        )
      }
      onPress={() => {
        if (props.onActivateFromProps !== undefined)
          props.onActivateFromProps();
        if (
          !checkedButtonIdList.includes(id) &&
          !disabledButtonIdList.includes(id)
        )
          setCheckedButtonList([info]);
      }}
    >
      <AppText style={tw.style(checkButtonStyle.text)}>{name}</AppText>
    </Pressable>
  );
};

export default SecondaryTabPart;

import {useEffect, useMemo} from 'react';
import {View, Pressable} from 'react-native';
// import {Pressable} from 'react-native-gesture-handler';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import type {ButtonStyle} from '../hooks/useButtonContext';
import {ButtonStates} from '../hooks/useButtonContext';
import {useButtonState} from '../hooks/useButtonState';

// UIPartsに与えるパラメーターの型宣言
export type Props = {
  readonly pressedOpacity?: number;
  readonly width?: string;
  readonly height?: string;
  readonly children?: ReactNode;
  readonly releasedButtonStyle?: string[];
  readonly pressedButtonStyle?: string[];
  readonly disabledButtonStyle?: string[];
  // readonly ref?: React.LegacyRef<View>;
  /* バケツリレーを避けるために、onPressInとonPressOutはContextを使用して指定する方法に変更する予定
	こonPressInとonPressoutはそのうち使わなくなるのでParts/Organismsレベルでは非推奨
	*/
  readonly onPressIn?: () => void;
  readonly onPressOut?: () => void;
  readonly isDisabled?: boolean;
};

const BasisButton = (props: Props) => {
  /* Propsの初期値を設定。これにより、このコンポーネントを引き継ぐときに不要なpropsを省略できる */
  const {
    width = '240px',
    height = '40px',
    children = undefined,
    releasedButtonStyle = [''],
    pressedButtonStyle = [''],
    disabledButtonStyle = [''],
  } = props;
  // 共通スタイルはwidth・heightを追加してメモ化
  const commonStyle = useMemo(
    () =>
      ['justify-center', 'items-center'].concat([`w-${width}`, `h-${height}`]),
    [width, height],
  );
  // ボタン用スタイルを定義
  const buttonStyleData: ButtonStyle = useMemo(() => {
    return {
      common: commonStyle,
      released: releasedButtonStyle,
      pressed: pressedButtonStyle,
      disabled: disabledButtonStyle,
    };
  }, [
    commonStyle,
    releasedButtonStyle,
    pressedButtonStyle,
    disabledButtonStyle,
  ]);
  // ボタンの状態を管理するための汎用カスタムフック
  const [
    buttonState,
    buttonStyle,
    buttonStyleDispatch,
    handlePressIn,
    handlePressOut,
    _setButtonState,
    handleAllPressOut,
  ] = useButtonState(buttonStyleData, ButtonStates.released);

  // ボタンの状態が変わるごとにスタイルを適用し直す
  useEffect(() => {
    buttonStyleDispatch(buttonState);
  }, [buttonState, buttonStyleDispatch]);

  /*
  useEffect(() => {
    // console.log('buttonStyle', buttonStyle);
  }, [buttonStyle]);
  */
  return (
    <View style={tw.style(buttonStyle)}>
      {children}
      <Pressable
        // 注意: Pressable の disabled を「押下中の内部状態(buttonState===disabled)」で
        // トグルしないこと。Fabric(新アーキ)では disabled を true→false に戻すと
        // 以後タッチ応答が復活しない不具合があり、1回押すと再度押せなくなる。
        // 二度押し防止は useButtonState の isProcessing ref が担保する。
        // disabled は外部からの恒久的な無効化(props.isDisabled)のみを反映する。
        disabled={props.isDisabled}
        style={tw.style(
          buttonStyle.concat([
            'absolute',
            'w-full',
            'h-full',
            'bg-transparent',
          ]),
        )}
        /*
        onHoverIn={() => {
          console.log('hoverIn');
        }}
        onHoverOut={() => {
          console.log('hoverOut');
        }}
        */
        onPressIn={() => {
          handlePressIn(props.onPressIn!);
        }}
        onPressOut={() => {
          handleAllPressOut();
        }}
        onPress={async () => {
          handleAllPressOut();
          await handlePressOut(props.onPressOut!).catch((error: unknown) => {
            console.error('Error in handlePressOut:', error);
          });
        }}
      />
    </View>
  );
};

export default BasisButton;

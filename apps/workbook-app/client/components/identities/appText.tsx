import {
  Text,
  Platform,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import {useMemo, type ReactNode} from 'react';
/**
 * Text要素のデフォルトスタイルのカスタマイズ
 */

export type AppTextProps = {
  readonly style?: TextStyle;
  readonly numberOfLines?: number;
  readonly children: ReactNode;
};

const AppText = (props: AppTextProps) => {
  const {scale} = useWindowDimensions();
  const fontScale = useMemo(() => {
    return Math.max(1, Math.floor((scale / 3) * 10) / 10);
  }, [scale]);
  const baseStyle: TextStyle = useMemo(() => {
    return {
      fontSize: 16,
      fontFamily: Platform.OS === 'ios' ? 'Hiragino Sans' : 'NotoSans',
    };
  }, []);
  const style = useMemo(() => {
    const _style = {...baseStyle, ...props.style};
    _style.fontSize = Math.floor(_style.fontSize! * fontScale * 10) / 10;
    return _style;
  }, [fontScale, props.style, baseStyle]);

  return (
    <Text
      style={{...style, ...props.style}}
      allowFontScaling={false}
      numberOfLines={props.numberOfLines}
    >
      {props.children}
    </Text>
  );
};

export default AppText;

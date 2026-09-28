import {View, useWindowDimensions} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';

export type DataBarProps = {
  readonly percentArray: number[];
  readonly label?: number[] | string[];
  readonly bgColor: string[];
  readonly textStyle?: string[][];
  readonly barRatio?: number;
  readonly barHeight: number;
};

const DataBar = (props: DataBarProps) => {
  const {width} = useWindowDimensions();
  const barWidth: number = useMemo(() => {
    if (!props.barRatio) return width / 2;
    return width * props.barRatio;
  }, [props.barRatio, width]);
  const {leftStyle, rightStyle} = useMemo(() => {
    return {
      leftStyle: 'rounded-l',
      rightStyle: 'rounded-r',
    };
  }, []);

  const percentArray: number[] = useMemo(
    () => props.percentArray,
    [props.percentArray],
  );
  const leftStyleArray = useMemo(() => {
    const array = Array.from<string>({length: percentArray.length}).fill('');
    for (const [i, element] of percentArray.entries()) {
      array[i] = element !== 0 && !array.includes(leftStyle) ? leftStyle : '';
    }

    return array;
  }, [percentArray, leftStyle]);

  const rightStyleArray = useMemo(() => {
    const reversedPercentArray = [...percentArray].reverse(); // [0, 0, 100, 10, 10]
    const array = Array.from<string>({
      length: reversedPercentArray.length,
    }).fill('');
    for (const [i, _element] of reversedPercentArray.entries()) {
      array[i] =
        reversedPercentArray[i] !== 0 && !array.includes(rightStyle)
          ? rightStyle
          : '';
    }

    array.reverse(); // 元の順番に戻す
    return array;
  }, [percentArray, rightStyle]);

  const dataBody = useMemo(() => {
    return percentArray.map((_v, i) => {
      const key = `ratio_${i}`;
      const width = (percentArray[i] / 100) * barWidth;
      const commonStyle = [
        `bg-${props.bgColor[i]}`,
        `w-[${width}px]`,
        `h-[${props.barHeight}px]`,
        `items-center`,
        `justify-center`,
      ];

      return (
        <View
          key={key}
          style={tw.style(commonStyle, leftStyleArray[i], rightStyleArray[i])}
        >
          {props.label && props.textStyle && (
            <AppText style={tw.style(props.textStyle[i])}>
              {width > 18 ? props.label[i] : null}
            </AppText>
          )}
        </View>
      );
    });
  }, [
    percentArray,
    props.label,
    props.textStyle,
    props.barHeight,
    props.bgColor,
    barWidth,
    leftStyleArray,
    rightStyleArray,
  ]);

  return (
    <View style={tw`flex-row w-[${barWidth}px] h-[${props.barHeight}px]`}>
      {dataBody}
    </View>
  );
};

export default DataBar;

import {View} from 'react-native';
import {useState, useCallback, useMemo, useContext, useEffect} from 'react';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import CheckBox from '../identities/checkBox';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type CheckBoxListProps = {
  readonly title?: string;
  readonly row?: number | undefined;
}; // buttonList: ButtonList

const CheckBoxList = (props: CheckBoxListProps) => {
  const {buttonInfoList} = useContext(CheckButtonContext);
  // console.log('checkedButttonList', checkedButtonList);

  // タイトルテキストがある場合
  const text: ReactNode = useCallback(() => {
    if (props.title !== '') {
      return (
        <>
          <AppText style={tw`text-secondary text-sm pl-4`}>
            {props.title}
          </AppText>
          <Spacer isHorizontal={false} size={4} />
        </>
      );
    }
  }, [props.title])();

  const oneRowList: React.JSX.Element[] = useMemo(() => {
    return Array.from({length: buttonInfoList.length}).map((_v, i) => {
      const keyView = `checkBoxKeyView_${i}`;
      return (
        <View key={keyView} style={tw`w-full h-5 pr-4 `}>
          <CheckBox
            info={buttonInfoList[i]}
            id={buttonInfoList[i].id}
            name={buttonInfoList[i].name}
            checkBoxStyle="flex-1 ml-4"
          />
        </View>
      );
    });
  }, [buttonInfoList]);

  const twoRowLength: number = useMemo(() => {
    return Math.ceil(buttonInfoList.length / 2);
  }, [buttonInfoList.length]);
  // console.log(length);

  const twoRowList: React.JSX.Element[] = useMemo(() => {
    return Array.from({length: twoRowLength}).map((_v, i) => {
      const keyA = `checkBoxKeyA_${i}`;
      const keyB = `checkBoxKeyB_${i}`;
      const keyViewA = `checkBoxKeyViewA_${i}`;
      const keyViewB = `checkBoxKeyViewB_${i}`;

      return (
        <View key={keyViewA} style={tw`w-full pr-4 `}>
          <View key={keyViewB} style={tw`flex-row`}>
            <CheckBox
              key={keyA}
              info={buttonInfoList[i * 2]}
              id={buttonInfoList[i * 2].id}
              name={buttonInfoList[i * 2].name}
              checkBoxStyle="flex-1 ml-4"
            />
            <Spacer isHorizontal size={8} />
            {buttonInfoList.length % 2 !== 0 && i === twoRowLength - 1 ? (
              <View style={tw`flex-1 ml-4`} /> // 奇数の場合最後のみ空
            ) : (
              <CheckBox
                key={keyB}
                info={buttonInfoList[i * 2 + 1]}
                id={buttonInfoList[i * 2 + 1].id}
                name={buttonInfoList[i * 2 + 1].name}
                checkBoxStyle="flex-1 ml-4"
              />
            )}
          </View>
          {i === twoRowLength - 1 ? null : (
            <Spacer isHorizontal={false} size={8} />
          )}
        </View>
      );
    });
  }, [buttonInfoList, twoRowLength]);

  const threeRowLength: number = useMemo(() => {
    return Math.ceil(buttonInfoList.length / 3);
  }, [buttonInfoList.length]);

  const numberArray: number[] = useMemo(() => {
    return buttonInfoList.map((_v, i) => {
      return i + 1;
    });
  }, [buttonInfoList]);

  // 配列を分割
  const sliceByNumber = useCallback((array: number[], number: number) => {
    const length: number = Math.ceil(array.length / number);
    return Array.from({length}).map((_v, i) => {
      // {length:length}が省略された
      return array.slice(i * number, (i + 1) * number);
    });
  }, []);

  const threeRowList: React.JSX.Element[] = useMemo(() => {
    const slicedByThreeArray = sliceByNumber(numberArray, 3);
    // console.log(slicedByThreeArray);

    return Array.from({length: threeRowLength}).map((_v, i) => {
      // console.log(buttonInfoList.length);
      // console.log(slicedByThreeArray[i]);
      // console.log(slicedByThreeArray[i][0]);

      const keyA = `checkBoxKeyA_${i}`;
      const keyB = `checkBoxKeyB_${i}`;
      const keyC = `checkBoxKeyC_${i}`;
      const keyViewA = `checkBoxKeyViewA_${i}`;
      const keyViewB = `checkBoxKeyViewB_${i}`;

      return (
        <View key={keyViewA} style={tw`w-full pr-4 `}>
          <View key={keyViewB} style={tw`flex-row`}>
            <CheckBox
              key={keyA}
              info={buttonInfoList[i * 3]}
              id={buttonInfoList[i * 3].id}
              name={buttonInfoList[i * 3].name}
              checkBoxStyle="flex-1 ml-4"
            />
            {slicedByThreeArray[i][0] === buttonInfoList.length ? (
              <View style={tw`flex-1 ml-4`} />
            ) : (
              <CheckBox
                key={keyB}
                info={buttonInfoList[i * 3 + 1]}
                id={buttonInfoList[i * 3 + 1].id}
                name={buttonInfoList[i * 3 + 1].name}
                checkBoxStyle="flex-1 ml-4"
              />
            )}
            {slicedByThreeArray[i][0] === buttonInfoList.length ||
            slicedByThreeArray[i][1] === buttonInfoList.length ? (
              <View style={tw`flex-1 ml-4`} />
            ) : (
              <CheckBox
                key={keyC}
                info={buttonInfoList[i * 3 + 2]}
                id={buttonInfoList[i * 3 + 2].id}
                name={buttonInfoList[i * 3 + 2].name}
                checkBoxStyle="flex-1 ml-4"
              />
            )}
          </View>
          {i === threeRowLength - 1 ? null : (
            <Spacer isHorizontal={false} size={8} />
          )}
        </View>
      );
    });
  }, [buttonInfoList, threeRowLength, sliceByNumber, numberArray]);

  const [checkBoxList, setCheckBoxList] = useState<React.JSX.Element[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (props.row === 1 || undefined) {
      setCheckBoxList(oneRowList);
    } else if (props.row === 2) {
      setCheckBoxList(twoRowList);
    } else {
      setCheckBoxList(threeRowList);
    }
  }, []);

  return (
    <View style={tw`items-center`}>
      <View style={tw`w-11/12 bg-white rounded-md`}>
        <Spacer isHorizontal={false} size={12} />
        {props.title ? text : undefined}
        {checkBoxList}
        <Spacer isHorizontal={false} size={12} />
      </View>
    </View>
  );
};

export default CheckBoxList;

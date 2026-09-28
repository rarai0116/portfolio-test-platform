import {View} from 'react-native';
import {useCallback, useMemo, useContext} from 'react';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import RadioButton from '../identities/radioButton';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import AppText from '../identities/appText';
import Spacer from './spacer';

export type RadioButtonListProps = {readonly title?: string}; // buttonList: ButtonList

const RadioButtonList = (properties: RadioButtonListProps) => {
  const {buttonInfoList} = useContext(CheckButtonContext);
  // console.log(buttonInfoList);

  const length = useMemo(() => {
    return Math.ceil(buttonInfoList.length / 2);
  }, [buttonInfoList.length]);
  // console.log(length);

  // タイトルテキストがある場合
  const text: ReactNode = useCallback(() => {
    if (properties.title !== '') {
      return (
        <>
          <AppText style={tw`text-secondary text-sm pl-4`}>
            {properties.title}
          </AppText>
          <Spacer isHorizontal={false} size={4} />
        </>
      );
    }
  }, [properties.title])();

  const array: React.JSX.Element[] = useMemo(() => {
    return Array.from({length: Math.ceil(buttonInfoList.length / 2)}).map(
      (_v, i) => {
        const keyA = `radioButtonKeyA_${i}`;
        const keyB = `radioButtonKeyB_${i}`;
        const keyViewA = `radioButtonKeyViewA_${i}`;
        const keyViewB = `radioButtonKeyViewB_${i}`;

        return (
          <View key={keyViewA} style={tw`w-full pr-4`}>
            <View key={keyViewB} style={tw`flex-row`}>
              <RadioButton
                key={keyA}
                info={buttonInfoList[i * 2]}
                id={buttonInfoList[i * 2].id}
                name={buttonInfoList[i * 2].name}
                radioButtonStyle="flex-1 ml-4"
              />
              {buttonInfoList.length % 2 !== 0 && i === length - 1 ? (
                <View style={tw`flex-1 ml-4`} /> // 奇数の場合最後のみ空
              ) : (
                <RadioButton
                  key={keyB}
                  info={buttonInfoList[i * 2 + 1]}
                  id={buttonInfoList[i * 2 + 1].id}
                  name={buttonInfoList[i * 2 + 1].name}
                  radioButtonStyle="flex-1 ml-4"
                />
              )}
            </View>
            {i === length - 1 ? null : <Spacer isHorizontal={false} size={8} />}
          </View>
        );
      },
    );
  }, [buttonInfoList, length]);

  return (
    <View style={tw`items-center`}>
      <View style={tw`w-11/12 bg-white rounded-md`}>
        <Spacer isHorizontal={false} size={12} />
        {properties.title ? text : undefined}
        {array}
        <Spacer isHorizontal={false} size={12} />
      </View>
    </View>
  );
};

export default RadioButtonList;

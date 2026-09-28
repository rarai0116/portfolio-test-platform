import {type LayoutChangeEvent, View} from 'react-native';
import {useCallback, useMemo} from 'react';
import tw from '../../tailwind.custom';
import CrossIcon from '../../assets/svg/cross_wrong-answer_small_blue.svg';
import CircleIcon from '../../assets/svg/circle_right-answer_small_blue.svg';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import {questionFormat} from '../../types/commonUnionType';
import type {QuestionFormatType} from '../../types/commonUnionType';
import ChoiceButton, {type ChoiceButtonProps} from '../parts/choiceButton';

export type ChoicesFooterProps = {
  readonly type: QuestionFormatType;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
  readonly onPress: (choiceNumber: number) => void;
  readonly isDisabled?: boolean;
};

// 1. MemorizedChoiceButtonを外部に移動し、比較関数を改善
const MemorizedChoiceButton = (
  props: ChoiceButtonProps & {
    readonly onPress: (choiceNumber: number) => void;
  },
) => {
  // 2. onPressOut関数をmemo化
  const handlePressOut = useCallback(() => {
    props.onPress(props.number ?? 0);
  }, [props]);

  if (props.type === questionFormat.qAndA) {
    // 3. Q&A形式の特別な処理
    return (
      <ButtonContextProvider
        key={`ChoicesFooter_contextProvider_${props.number}`}
        state={ButtonStates.released}
        onPressOut={handlePressOut}
      >
        <ChoiceButton
          type={props.type}
          number={props.number ?? 0}
          isDisabled={props.isDisabled}
        >
          {props.number === 1 ? (
            <CircleIcon width={24} height={24} fill="#289DF4" />
          ) : (
            <CrossIcon width={24} height={24} fill="#289DF4" />
          )}
        </ChoiceButton>
      </ButtonContextProvider>
    );
  }

  return (
    <ButtonContextProvider
      key={`ChoicesFooter_contextProvider_${props.number}`}
      state={ButtonStates.released}
      onPressOut={handlePressOut}
    >
      <ChoiceButton
        type={props.type}
        number={props.number ?? 0}
        isDisabled={props.isDisabled}
      />
    </ButtonContextProvider>
  );
};

const ChoicesFooter = (props: ChoicesFooterProps) => {
  // 4. ボタン数の計算をmemo化
  const buttonLength = useMemo(() => {
    if (props.type === questionFormat.qAndA) return 2;
    return props.type === questionFormat.fourChoices ? 4 : 5;
  }, [props.type]);

  // 5. buttonsの生成をより効率的に
  const buttons = useMemo(() => {
    return Array.from({length: buttonLength}, (_, index) => {
      const buttonNumber = index + 1;
      return (
        <MemorizedChoiceButton
          key={buttonNumber} // keyを簡素化
          type={props.type}
          number={buttonNumber}
          isDisabled={props.isDisabled}
          onPress={props.onPress}
        />
      );
    });
  }, [props.type, buttonLength, props.onPress, props.isDisabled]);

  return (
    <View
      style={tw.style(`absolute self-end bottom-0 w-100% px-5 py-3 bg-white `)}
      onLayout={props.onLayout}
    >
      <View style={tw`flex-row justify-around`}>{buttons}</View>
    </View>
  );
};

export default ChoicesFooter;

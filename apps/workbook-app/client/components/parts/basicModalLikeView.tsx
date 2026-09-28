import {View, Keyboard} from 'react-native';
import type {ReactNode} from 'react';
import {useContext, useEffect} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {
  ButtonContextProvider,
  ButtonStates,
  type ButtonStateType,
} from '../hooks/useButtonContext';
import ModalLikeView from '../identities/modalLikeView';
import {TextInputContext} from '../hooks/useTextInputContextProvider';
import AppTextInput from '../identities/appTextInput';
import Spacer from './spacer';
import SecondaryLongButton from './secondaryLongButton';
import ThirdlyLongButton from './thirdlyLongButton';
import {modalHeaderRight} from './halfModalHeader';
import PrimaryLongButton from './primaryLongButton';

export type BasicModalLikeViewProps = {
  readonly title?: string;
  readonly text?: string;
  readonly id: string;
  readonly children?: ReactNode;
  readonly hasInput: boolean;
  readonly primaryButtonText?: string;
  readonly secondaryButtonText?: string;
  readonly thirdlyButtonText?: string;
  readonly onPressOutPrimaryButton?: () => void;
  readonly onPressOutSecondaryButton?: () => void;
  readonly onPressOutThirdlyButton?: () => void;
  readonly inputDefaultValue?: string;
  readonly basicHalfModalInputId?: string;
  readonly isInReactNativeModal?: boolean;
  readonly primaryButtonState?: ButtonStateType;
};

const BasicModalLikeView = (props: BasicModalLikeViewProps) => {
  const {setTextValue} = useContext(TextInputContext);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (props.inputDefaultValue && props.hasInput) {
      setTextValue(props.inputDefaultValue);
    }
  }, [props.inputDefaultValue, props.hasInput]);

  return (
    <ModalLikeView
      id={props.id}
      hasHeader={false}
      modalHeaderRightButton={modalHeaderRight.none}
      isInReactNativeModal={props.isInReactNativeModal ?? true}
    >
      <AppText style={tw`text-base text-primary font-semibold`}>
        {props.title}
      </AppText>

      <Spacer isHorizontal={false} size={8} />

      {props.text ? (
        <>
          <AppText style={tw`text-sm text-primary text-center`}>
            {props.text}
          </AppText>
          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}

      {props.children ? (
        <>
          {props.children}
          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}

      {props.hasInput ? (
        <>
          <View style={tw`w-11/12`}>
            <AppTextInput
              isShowWordCount
              textAlignVertical="center"
              height={32}
              id={props.basicHalfModalInputId ?? ''}
              maxLength={20}
              defaultValue={props.inputDefaultValue}
              inputStyle="w-full py-1 px-2 border border-tertiary rounded"
            />
          </View>

          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}
      {props.primaryButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            state={props.primaryButtonState ?? ButtonStates.released}
            onPressOut={() => {
              // hideModal();
              props.onPressOutPrimaryButton?.();

              Keyboard.dismiss();
            }}
          >
            <PrimaryLongButton text={props.primaryButtonText} />
          </ButtonContextProvider>

          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}
      {props.secondaryButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            onPressOut={() => {
              // hideModal();
              props.onPressOutSecondaryButton?.();

              Keyboard.dismiss();
            }}
          >
            <SecondaryLongButton text={props.secondaryButtonText} />
          </ButtonContextProvider>
          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}
      {props.thirdlyButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            onPressOut={() => {
              // hideModal();
              props.onPressOutThirdlyButton?.();

              Keyboard.dismiss();
            }}
          >
            <ThirdlyLongButton text={props.thirdlyButtonText} />
          </ButtonContextProvider>
        </>
      ) : null}
      {/* <Spacer isHorizontal={false} size={16} /> */}
    </ModalLikeView>
  );
};

export default BasicModalLikeView;

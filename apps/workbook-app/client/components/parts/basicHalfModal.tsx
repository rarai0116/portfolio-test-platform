import {View} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {useContext, memo, type ReactNode} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import HalfModal from '../identities/halfModal';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import AppTextInput from '../identities/appTextInput';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import PrimaryLongButton from './primaryLongButton';
import SecondaryLongButton from './secondaryLongButton';
import ThirdlyLongButton from './thirdlyLongButton';
import Spacer from './spacer';
import {modalHeaderRight} from './halfModalHeader';

export type BasicHalfModalProps = {
  readonly title?: string;
  readonly text?: string;
  readonly id: string;
  readonly isButtonsDisabled?: boolean;
  readonly isBackDropPressFreeze?: boolean;
  readonly children?: ReactNode;
  readonly hasInput: boolean;
  readonly primaryButtonText?: string;
  readonly secondaryButtonText?: string;
  readonly thirdlyButtonText?: string;
  readonly onPressOutPrimaryButton?: () => void;
  readonly onPressOutSecondaryButton?: () => void;
  readonly onPressOutThirdlyButton?: () => void;
  readonly inputDefaultValue?: string;
  readonly backDropPress?: () => void;
  readonly basicHalfModalInputId?: string;
  readonly modalStyle?: string;
};

const BasicHalfModal = memo((props: BasicHalfModalProps) => {
  const {activeModal} = useContext(ModalManagerContext);
  /*
  const {textValue, setTextValue} = useContext(TextInputContext);
  const [isForceBackDropPressFreeze, setIsForceBackDropPressFreeze] =
    useState<boolean>(false);
  const [basicHalfModalInputId, setBasicHalfModalInputId] =
    useState<string>('');
  useEffect(() => {
    if (props.inputDefaultValue && props.hasInput) {
      setTextValue(props.inputDefaultValue);
      console.log(props.inputDefaultValue);
    }
  }, [props.inputDefaultValue, props.hasInput]);

  useEffect(() => {
    if (props.backDropPress === undefined) {
      setIsForceBackDropPressFreeze(true);
    }
  }, [props.backDropPress]);

  useEffect(() => {
    if (props.basicHalfModalInputId) {
      setBasicHalfModalInputId(props.basicHalfModalInputId);
    } else {
      setBasicHalfModalInputId(`input_${props.id}`);
    }
  }, [props.basicHalfModalInputId]);
  */

  return (
    <HalfModal
      id={props.id}
      hasHeader={false}
      modalHeaderRightButton={modalHeaderRight.none}
      isBackDropPressFreeze={props.isBackDropPressFreeze ?? true}
      backDropPress={props.backDropPress}
      style={props.modalStyle ?? ''}
    >
      <AppText style={tw`text-base text-primary font-semibold`}>
        {props.title}
      </AppText>

      <Spacer isHorizontal={false} size={8} />

      {props.text ? (
        <ScrollView style={tw`w-11/12`}>
          <AppText style={tw`text-sm text-primary text-left`}>
            {props.text}
          </AppText>
          <Spacer isHorizontal={false} size={8} />
        </ScrollView>
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
              isAutoFocus
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
            state={props.isButtonsDisabled ? ButtonStates.released : undefined}
            onPressOut={() => {
              if (activeModal !== props.id) return;
              // hideModal();
              props.onPressOutPrimaryButton?.();
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
            state={props.isButtonsDisabled ? ButtonStates.disabled : undefined}
            onPressOut={() => {
              if (activeModal !== props.id) return;
              // hideModal();
              props.onPressOutSecondaryButton?.();
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
            state={props.isButtonsDisabled ? ButtonStates.disabled : undefined}
            onPressOut={() => {
              if (activeModal !== props.id) return;
              // hideModal();
              props.onPressOutThirdlyButton?.();
            }}
          >
            <ThirdlyLongButton text={props.thirdlyButtonText} />
          </ButtonContextProvider>
        </>
      ) : null}
    </HalfModal>
  );
});

export default BasicHalfModal;

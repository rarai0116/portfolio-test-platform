import {useContext} from 'react';
import type {ReactNode} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import {ButtonContextProvider} from '../hooks/useButtonContext';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import ModalWindow from '../identities/modalWindow';
import PrimaryShortButton from './primaryShortButton';
import SecondaryShortButton from './secondaryShortButton';
import ThirdlyShortButton from './thirdlyShortButton';
import Spacer from './spacer';

export type BasicModalWindowProps = {
  readonly title?: string;
  readonly text?: string;
  readonly id: string;
  readonly isBackDropPressFreeze?: boolean;
  readonly children?: ReactNode;
  readonly primaryButtonText?: string;
  readonly secondaryButtonText?: string;
  readonly thirdlyButtonText?: string;
  readonly onPressOutPrimaryButton?: () => void;
  readonly onPressOutSecondaryButton?: () => void;
  readonly onPressOutThirdlyButton?: () => void;
  readonly backDropPress?: () => void;
};

const BasicModalWindow = (props: BasicModalWindowProps) => {
  const {hideModal} = useContext(ModalManagerContext);

  return (
    <ModalWindow
      id={props.id}
      isBackDropPressFreeze={props.isBackDropPressFreeze}
      backDropPress={props.backDropPress}
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

      {props.primaryButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            onPressOut={() => {
              hideModal();
              props.onPressOutPrimaryButton?.();
            }}
          >
            <PrimaryShortButton text={props.primaryButtonText} />
          </ButtonContextProvider>

          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}
      {props.secondaryButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            onPressOut={() => {
              hideModal();
              props.onPressOutSecondaryButton?.();
            }}
          >
            <SecondaryShortButton text={props.secondaryButtonText} />
          </ButtonContextProvider>
          <Spacer isHorizontal={false} size={8} />
        </>
      ) : null}
      {props.thirdlyButtonText ? (
        <>
          <Spacer isHorizontal={false} size={8} />
          <ButtonContextProvider
            onPressOut={() => {
              hideModal();
              props.onPressOutThirdlyButton?.();
            }}
          >
            <ThirdlyShortButton text={props.thirdlyButtonText} />
          </ButtonContextProvider>
        </>
      ) : null}
    </ModalWindow>
  );
};

export default BasicModalWindow;

import type {ReactNode} from 'react';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import BasisButton from '../identities/button';
import AppText from '../identities/appText';
import {questionFormat} from '../../types/commonUnionType';
import type {QuestionFormatType} from '../../types/commonUnionType';

export type ChoiceButtonProps = {
  readonly type: QuestionFormatType;
  readonly number?: number;
  readonly children?: ReactNode;
  readonly isDisabled?: boolean;
};

const ChoiceButton = (props: ChoiceButtonProps) => {
  const buttonContent = useMemo(async () => {
    if (props.type !== questionFormat.qAndA) {
      return (
        <AppText style={tw`text-xl text-workbookblue-500 mt-1`}>
          {props.number}
        </AppText>
      );
    }

    return props.children;
  }, [props]);

  return (
    <BasisButton
      width="48px"
      height="48px"
      pressedOpacity={1}
      releasedButtonStyle={[
        'rounded-md',
        'bg-white',
        'border-solid',
        'border-[0.5px]',
        'border-workbookblue-500',
      ]}
      pressedButtonStyle={[
        'rounded-md',
        'bg-workbookblue-100',
        'border-solid',
        'border-[0.5px]',
        'border-workbookblue-500',
      ]}
      disabledButtonStyle={[
        'rounded-md',
        'bg-gray-200',
        'border-solid',
        'border-[0.5px]',
        'border-gray-400',
      ]}
      isDisabled={props.isDisabled}
    >
      {buttonContent}
    </BasisButton>
  );
};

export default ChoiceButton;

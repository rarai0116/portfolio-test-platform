import {View} from 'react-native';
import {useMemo} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import BasisButton from '../identities/button';
import type {ButtonStateType} from '../hooks/useButtonContext';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import FolderIcon from '../../assets/svg/folder_saved-condition-button.svg';
import DeleteIcon from '../../assets/svg/trash-can_delete-task-icon.svg';
import CrossButton from './crossButton';
import Spacer from './spacer';

export const modalHeaderRight = {
  none: 'なし',
  confirm: '決定',
  save: '保存',
  delete: '削除',
} as const;
export type ModalHeaderRightButton =
  (typeof modalHeaderRight)[keyof typeof modalHeaderRight];

export type HalfModalHeaderProps = {
  readonly onPressOutCrossButton: () => void;
  readonly onPressOutRightButton?: () => void;
  readonly rightButtonType: ModalHeaderRightButton;
  readonly rightButtonStates?: ButtonStateType;
  // 保存のみ
  readonly rightButtonColor?: string;
};

const HalfModalHeader = (props: HalfModalHeaderProps) => {
  const rightButton = useMemo(() => {
    switch (props.rightButtonType) {
      case modalHeaderRight.none: {
        return;
      }

      case modalHeaderRight.confirm: {
        return (
          <BasisButton
            width="60px"
            height="48px"
            releasedButtonStyle={['rounded-tr-xl px-2 py-2']}
            pressedButtonStyle={['rounded-tr-xl bg-quaternary px-2 py-2']}
            disabledButtonStyle={['rounded-tr-xl bg-secondary px-2 py-2']}
            pressedOpacity={1}
          >
            <AppText style={tw`text-primary text-xl`}>決定</AppText>
          </BasisButton>
        );
      }

      case modalHeaderRight.save: {
        return (
          <BasisButton
            width="80px"
            height="48px"
            releasedButtonStyle={['rounded-tr-xl px-2 py-2']}
            pressedButtonStyle={['rounded-tr-xl bg-quaternary px-2 py-2']}
            disabledButtonStyle={['rounded-tr-xl bg-white px-2 py-2']}
            pressedOpacity={1}
          >
            <View style={tw`flex-row items-center`}>
              <FolderIcon
                width={24}
                height={24}
                fill={props.rightButtonColor}
              />
              <Spacer isHorizontal size={4} />
              <AppText style={tw`text-[${props.rightButtonColor!}]`}>
                保存
              </AppText>
            </View>
          </BasisButton>
        );
      }

      case modalHeaderRight.delete: {
        return (
          <BasisButton
            width="80px"
            height="48px"
            releasedButtonStyle={['rounded-tr-xl px-2 py-2']}
            pressedButtonStyle={['rounded-tr-xl bg-quaternary px-2 py-2']}
            disabledButtonStyle={['rounded-tr-xl bg-white px-2 py-2']}
            pressedOpacity={1}
          >
            <View style={tw`flex-row items-center`}>
              <DeleteIcon
                width={24}
                height={24}
                fill={props.rightButtonColor}
              />
            </View>
          </BasisButton>
        );
      }
    }
  }, [props.rightButtonType, props.rightButtonColor]);

  return (
    <View
      style={tw`w-full h-12 rounded-t-xl bg-white justify-between flex-row mt-0`}
    >
      <ButtonContextProvider
        state={ButtonStates.released}
        onPressOut={props.onPressOutCrossButton}
      >
        <CrossButton
          outsidewidth="60px"
          outsideHeight="48px"
          crossSize="16px"
          releasedButtonStyle={['rounded-tl-xl px-2 py-2']}
          pressedButtonStyle={['rounded-tl-xl bg-quaternary px-2 py-2']}
          disabledButtonStyle={['rounded-tl-xl bg-quaternary px-2 py-2']}
          color="#727272"
        />
      </ButtonContextProvider>

      <ButtonContextProvider
        state={props.rightButtonStates ?? ButtonStates.released}
        onPressOut={props.onPressOutRightButton}
      >
        {rightButton}
      </ButtonContextProvider>
    </View>
  );
};

export default HalfModalHeader;

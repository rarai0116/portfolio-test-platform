import {View, Platform} from 'react-native';
import {useEffect, useState, useCallback, useMemo, useContext} from 'react';
import {Picker} from '@react-native-picker/picker';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import HalfModal from '../identities/halfModal';
import type {ButtonStateType} from '../hooks/useButtonContext';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import BasisButton from '../identities/button';
import DownArrow from '../../assets/svg/down-arrow.svg';
import {
  CheckButtonContext,
  CheckButtonStates,
} from '../hooks/useCheckButtonContext';
import {ModalManagerContext} from '../hooks/useModalManagerContext';
import Spacer from './spacer';
import {modalHeaderRight} from './halfModalHeader';

export type BasicPickerProps = {
  readonly isEnabled?: boolean;
  readonly idForIoS: string;
  readonly onPressIosRightButton?: () => void;
};

const BasicPicker = (props: BasicPickerProps) => {
  const {showModal} = useContext(ModalManagerContext);
  /*
	useEffect(() => {
		setModalList({iosPickerModal: 'iosPickerModal'});
	}, []);
	*/
  const [selected, setSelected] = useState('選択してください');

  const [iosButtonState, setIosButtonState] = useState<ButtonStateType>(
    ButtonStates.released,
  );

  const {setCheckedButtonList, buttonInfoList} = useContext(CheckButtonContext);

  const pickerItems = useMemo(() => {
    return buttonInfoList.map((v, i) => {
      const key = `PickerItem_${i}`;
      return <Picker.Item key={key} label={v.name} value={v.name} />;
    });
  }, [buttonInfoList]);

  // 課題データの場合は選択できないようにする
  const disablePicker = useCallback(() => {
    if (!props.isEnabled) {
      for (const element of buttonInfoList) {
        if (element.initialState === CheckButtonStates.disabledChecked) {
          setSelected(element.name);
          setIosButtonState(ButtonStates.disabled);
        }
      }
    }
  }, [props.isEnabled, buttonInfoList]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    disablePicker();
  }, [props.isEnabled]);

  // 保存データの場合は初期値を設定
  const setPicker = useCallback(() => {
    for (const element of buttonInfoList) {
      if (element.initialState === CheckButtonStates.checked) {
        setSelected(element.name);
      }
    }
  }, [buttonInfoList]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    setPicker();
  }, []);

  return Platform.OS === 'ios' ? (
    <View style={tw`items-center`}>
      <ButtonContextProvider
        state={iosButtonState}
        onPressOut={() => {
          showModal(props.idForIoS);
        }}
      >
        <BasisButton
          width="11/12"
          height="40px"
          pressedOpacity={1}
          releasedButtonStyle={['rounded-md bg-white border border-tertiary']}
          pressedButtonStyle={[
            'rounded-md bg-quaternary border border-tertiary',
          ]}
          disabledButtonStyle={[
            'rounded-md bg-quaternary border border-tertiary',
          ]}
        >
          <View style={tw`w-11/12 flex-row items-center justify-between`}>
            <AppText style={tw`text-primary text-base`}>{selected}</AppText>
            <DownArrow
              fill={props.isEnabled ? '#3F3F3F' : '#BABABA'}
              width={16}
              height={16}
            />
          </View>
        </BasisButton>
      </ButtonContextProvider>
      <HalfModal
        hasHeader
        id={props.idForIoS}
        modalHeaderRightButton={modalHeaderRight.confirm}
        onPressOutRightButton={props.onPressIosRightButton}
      >
        <Picker
          style={tw`w-full h-30`}
          enabled={props.isEnabled}
          /* dropdownIconColor={tw.color('text-primary')} */
          selectedValue={selected}
          itemStyle={tw`text-tertiary`}
          onValueChange={(itemValue, itemIndex) => {
            setSelected(itemValue);
            setCheckedButtonList([buttonInfoList[itemIndex]]);
          }}
        >
          {pickerItems}
        </Picker>
        <Spacer isHorizontal={false} size={120} />
      </HalfModal>
    </View>
  ) : (
    <View style={tw`items-center`}>
      <View
        style={tw`flex items-center w-11/12 h-14 border
				${props.isEnabled ? `bg-white` : `bg-quaternary`} border-tertiary rounded-md`}
      >
        <Picker
          style={tw`w-[98%] ${props.isEnabled ? `bg-white` : `bg-quaternary`}
					border border-tertiary rounded-md text-primary`}
          enabled={props.isEnabled}
          dropdownIconColor={tw.color(
            props.isEnabled ? 'text-primary' : 'text-tertiary',
          )}
          itemStyle={tw`text-primary`}
          selectedValue={selected}
          onValueChange={(itemValue, itemIndex) => {
            setSelected(itemValue);
            setCheckedButtonList([buttonInfoList[itemIndex]]);
          }}
        >
          {pickerItems}
        </Picker>
      </View>
    </View>
  );
};

export default BasicPicker;

import {View} from 'react-native';
import {useContext} from 'react';
import tw from '../../tailwind.custom';
import PrimaryShortButton from '../parts/primaryShortButton';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import {ModalManagerContext} from '../hooks/useModalManagerContext';

type StartTaskFooterProps = {
  readonly onPressStart: () => void;
  // ReactNativeModalの中にある場合paddingを調整する必要あり
  readonly isInReactNativeModal?: boolean;
};

const StartTaskFooter = (props: StartTaskFooterProps) => {
  const {hideModal} = useContext(ModalManagerContext);

  return (
    <View style={tw`items-center py-4 w-full`}>
      <ButtonContextProvider
        state={ButtonStates.released}
        onPressOut={() => {
          hideModal(() => {
            props.onPressStart();
          });
        }}
      >
        <PrimaryShortButton text="課題を開始" />
      </ButtonContextProvider>
      {/* {props.isInReactNativeModal && Platform.OS === 'android' && (
          <Spacer isHorizontal={false} size={24} />
        )} */}
    </View>
  );
};

export default StartTaskFooter;

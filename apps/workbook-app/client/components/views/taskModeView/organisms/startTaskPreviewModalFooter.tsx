import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import PrimaryShortButton from '@parts/primaryShortButton';
import {
  ButtonContextProvider,
  type ButtonStateType,
} from '@hooks/useButtonContext';
import {TaskModeViewContext} from '../hooks/useTaskModeViewContext';
import {questionState} from '@/types/commonUnionType';
import tw from '@/tailwind.custom';

type StartTaskPreviewModalFooterProps = {
  readonly onPressOut?: () => void;
  readonly buttonState?: ButtonStateType;
};

const StartTaskPreviewModalFooter = (
  props: StartTaskPreviewModalFooterProps,
) => {
  const {selectedTaskData} = useContext(TaskModeViewContext);

  const footerText = useMemo(() => {
    if (!selectedTaskData) return 'ahi';
    if (!selectedTaskData.taskSetting) return 'ahi2';

    return selectedTaskData.taskSetting?.taskState === questionState.progress
      ? '課題を再開'
      : '課題を開始';
  }, [selectedTaskData]);

  return (
    <View style={tw`items-center py-4`}>
      <ButtonContextProvider
        state={props.buttonState}
        onPressOut={() => {
          props.onPressOut?.();
        }}
      >
        <PrimaryShortButton text={footerText} />
      </ButtonContextProvider>
      {/* {Platform.OS === 'android' && <Spacer isHorizontal={false} size={24} />} */}
    </View>
  );
};

export default StartTaskPreviewModalFooter;

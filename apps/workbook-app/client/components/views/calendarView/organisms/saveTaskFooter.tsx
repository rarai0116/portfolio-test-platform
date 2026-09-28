import {View} from 'react-native';
import {useContext} from 'react';
import tw from '../../../../tailwind.custom';
import PrimaryShortButton from '../../../parts/primaryShortButton';
import {ButtonContextProvider} from '../../../hooks/useButtonContext';
import {ModalLikeViewManagerContext} from '../../../hooks/useModalLikeViewManagerContext';
import {calendarTaskSettingModalStates} from '../../../../types/commonUnionType';
import {CalendarTaskSettingViewModalContext} from '../hooks/useCalendarTaskSettingViewModalContext';

type SaveTaskFooterProps = Record<string, never>;

const SaveTaskFooter = (_props: SaveTaskFooterProps) => {
  const {showModalLikeView} = useContext(ModalLikeViewManagerContext);
  const {taskSaveButtonState, temporaryTaskSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  return (
    <View style={tw`py-4 items-center`}>
      <ButtonContextProvider
        state={taskSaveButtonState}
        onPressOut={() => {
          if (temporaryTaskSetting.taskSetting?.hasTask) {
            showModalLikeView(calendarTaskSettingModalStates.askSaveSetting);
          } else {
            showModalLikeView(calendarTaskSettingModalStates.notSetTaskSetting);
          }
        }}
      >
        <PrimaryShortButton text="保存" />
      </ButtonContextProvider>
    </View>
  );
};

export default SaveTaskFooter;

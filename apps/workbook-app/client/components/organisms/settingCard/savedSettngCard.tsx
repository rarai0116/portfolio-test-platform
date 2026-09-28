import {View} from 'react-native';
import {Pressable} from 'react-native-gesture-handler';
import {useCallback, useContext, memo} from 'react';
import AppText from '@identities/appText';
import {ModalManagerContext} from '@hooks/useModalManagerContext';
import MemoIcon from '@assets/svg/sticky-note_saved-condition-icon.svg';
import BuildingIcon from '@assets/svg/building_saved-condition-icon.svg';
import PenIcon from '@assets/svg/pen_common.svg';
import {ButtonContextProvider, ButtonStates} from '@hooks/useButtonContext';
import Spacer from '@parts/spacer';
import CrossButton from '@parts/crossButton';
import {
  GlobalSaveDataContext,
  type SettingCardData,
} from '@hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '@hooks/useGlobalUserSettingContext';
import useSettingCard from '@hooks/useSettingCard';
import {QuestionSettingViewContext} from '@hooks/useQuestionSettingViewContext';
import tw from '@/tailwind.custom';
import {
  questionSettingState,
  settingCardModalStates,
} from '@/types/commonUnionType';

export type SavedSettngCardProps = {
  // IDの接頭辞task・saved・previous・interruptedによって種類を判別する
  readonly id: string;
  readonly hasInterruptedData?: boolean;
  readonly onPressOut?: (id: string, cardData: SettingCardData | null) => void;
  readonly isDisablePress?: boolean;
};
const SavedSettngCard = memo(
  (props: SavedSettngCardProps) => {
    const {showModal} = useContext(ModalManagerContext);
    const {setTargetSavedSettingId} = useContext(GlobalSaveDataContext);
    const {isDisabledInput} = useContext(GlobalUserSettingContext);
    const {isInCalendarTaskSetting} = useContext(QuestionSettingViewContext);

    const [
      cardData,
      _taskDate,
      _deadlineDate,
      titleColor,
      borderColor,
      categoryString,
      otherSettingString,
    ] = useSettingCard(props.id, props.hasInterruptedData);

    const onPressCrossButton = useCallback(() => {
      setTargetSavedSettingId(props.id);
      showModal(settingCardModalStates.deleteSettingModal);
    }, [showModal, props.id, setTargetSavedSettingId]);
    if (cardData === null) return null;

    return (
      <View style={tw`w-11/12 items-center`}>
        <Pressable
          disabled={isDisabledInput || props.isDisablePress}
          style={({pressed}) =>
            tw`${borderColor} bg-white w-full rounded-md ${
              pressed ? 'bg-gray-200' : ''
            }`
          }
          android_ripple={{color: '#ECECEC'}}
          onPress={() => {
            if (props.onPressOut) props.onPressOut(props.id, cardData);
          }}
        >
          <View style={tw`w-full`}>
            {/* ヘッダー */}
            <View style={tw`flex-row items-center justify-between pl-4`}>
              <View
                style={tw`${cardData.settingState === questionSettingState.previous ? `` : `pt-3`}`}
              >
                {cardData.settingState !== questionSettingState.previous &&
                  cardData.settingState !==
                    questionSettingState.interrupted && (
                    <AppText
                      style={tw`${titleColor} text-sm`}
                      numberOfLines={1}
                    >
                      {cardData.title}
                    </AppText>
                  )}
              </View>
            </View>

            <View style={tw`w-full px-4 pb-3`}>
              <Spacer isHorizontal={false} size={4} />
              <View style={tw`flex-row items-center`}>
                <PenIcon
                  fill="#727272"
                  width={16}
                  height={16}
                  style={tw`mb-0.5`}
                />
                <Spacer isHorizontal size={8} />
                <AppText
                  style={tw`w-11/12 text-sm text-primary`}
                  numberOfLines={1}
                >
                  {cardData.questionMode}
                </AppText>
              </View>

              <Spacer isHorizontal={false} size={4} />

              <View style={tw`flex-row items-center`}>
                <BuildingIcon width={16} height={16} style={tw``} />
                <Spacer isHorizontal size={8} />
                <AppText
                  style={tw`w-11/12 text-sm text-primary`}
                  numberOfLines={1}
                >
                  {categoryString}
                </AppText>
              </View>

              <Spacer isHorizontal={false} size={4} />

              <View style={tw`flex-row items-center`}>
                <MemoIcon width={16} height={16} style={tw``} />
                <Spacer isHorizontal size={8} />
                <AppText
                  style={tw`w-11/12 text-sm text-primary`}
                  numberOfLines={1}
                >
                  {otherSettingString}
                </AppText>
              </View>
            </View>
          </View>
        </Pressable>
        {isInCalendarTaskSetting ? null : (
          <View style={tw`absolute right-0 top-0`}>
            <ButtonContextProvider
              state={ButtonStates.released}
              onPressOut={onPressCrossButton}
            >
              <CrossButton
                color="#727272"
                crossSize="12px"
                outsideHeight="36px"
                outsidewidth="48px"
                releasedButtonStyle={['']}
                pressedButtonStyle={['bg-quaternary']}
                disabledButtonStyle={['bg-secondary']}
              />
            </ButtonContextProvider>
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // カスタム比較関数で必要な場合のみ再レンダリング
    return (
      prevProps.id === nextProps.id &&
      prevProps.isDisablePress === nextProps.isDisablePress
    );
  },
);

export default SavedSettngCard;
